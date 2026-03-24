"""
ClubSystem — Reservation Service
=================================
Capa de servicio centralizada para la lógica de negocio de reservas.
Compartida entre el router de administración (reservations.py) y la
app móvil (mobile_app.py) para garantizar Single Source of Truth.

API pública:
  CLUB_TZ                     — Zona horaria compartida (Argentina).
  day_utc_bounds(day)         — Fecha local → rango UTC (start, end).
  to_tz_aware(dt)             — Normaliza datetime naive a CLUB_TZ.
  resolve_court_price(...)    — Precio según membresía y duración.
  validate_operational_hours(...)  — Valida horario operativo del club.
  check_membership(...)       — Verifica ClubMembership con status APPROVED.
  create_core_reservation(...) — Única función que hace db.add/commit.
"""

from datetime import date, datetime, time, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.court import Court
from app.models.reservation import Reservation

# ── Timezone ──────────────────────────────────────────────────────────────────
# Argentina no cambia hora (UTC-3 fijo).
# TODO: derivar de Club.timezone cuando ese campo exista en el modelo.
CLUB_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


# ── Fecha / hora ──────────────────────────────────────────────────────────────

def day_utc_bounds(day: date) -> tuple[datetime, datetime]:
    """
    Convierte una fecha local (Argentina) a un rango UTC start/end.
    Ejemplo: 2026-03-17 ART → (2026-03-17T03:00:00Z, 2026-03-18T02:59:59.999999Z)

    Sin esto, una reserva a las 00:30 ART (03:30 UTC) quedaría fuera
    del rango si se consultara con naive UTC midnight boundaries.
    """
    local_start = datetime.combine(day, time.min, tzinfo=CLUB_TZ)
    local_end   = datetime.combine(day, time.max, tzinfo=CLUB_TZ)
    return (
        local_start.astimezone(timezone.utc),
        local_end.astimezone(timezone.utc),
    )


def to_tz_aware(dt: datetime) -> datetime:
    """
    Normaliza un datetime a timezone-aware.
    Si llega naive (sin offset), asume hora local del club (CLUB_TZ).
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=CLUB_TZ)


# ── Precio ────────────────────────────────────────────────────────────────────

def resolve_court_price(
    court: Court,
    is_member: bool,
    duration_minutes: int = 60,
) -> float:
    """
    Calcula el precio de una cancha según membresía y duración.

    - is_member=True  → price_member (fallback: hourly_rate)
    - is_member=False → price_guest  (fallback: hourly_rate)
    - El resultado se escala por duración / 60.
      Con duration_minutes=60 (default) retorna la tarifa horaria sin cambios.
    """
    base = float(
        (court.price_member if court.price_member is not None else court.hourly_rate)
        if is_member else
        (court.price_guest  if court.price_guest  is not None else court.hourly_rate)
    )
    return base * duration_minutes / 60.0


# ── Validaciones de negocio ───────────────────────────────────────────────────

def validate_operational_hours(
    club: Club | None,
    starts_aware: datetime,
    ends_aware:   datetime,
) -> None:
    """
    Lanza HTTPException 400 si la reserva cae fuera del horario operativo.

    Solo se aplica cuando el club tiene ambos horarios configurados y
    representan un turno dentro del mismo día (open_time < close_time).
    Si club es None o no tiene horarios definidos, la función no hace nada.

    Diseño — por qué datetime.combine y no .time():
      1. Rollover de medianoche: una reserva que termine a las 00:30 del día
         siguiente tendría ends_local.time() == 00:30, menor que close_time,
         y la comparación aceptaría un horario inválido.
      2. Datetime naive: si el cliente omite el offset de zona horaria,
         .astimezone() asume la TZ del sistema (UTC en producción), no ART,
         desplazando la comparación 3 horas.
    """
    if not (club and club.open_time and club.close_time and club.open_time < club.close_time):
        return

    local_date  = starts_aware.astimezone(CLUB_TZ).date()
    open_bound  = datetime.combine(local_date, club.open_time,  tzinfo=CLUB_TZ)
    close_bound = datetime.combine(local_date, club.close_time, tzinfo=CLUB_TZ)

    if starts_aware < open_bound or ends_aware > close_bound:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="El horario de la reserva está fuera del horario de operación del club.",
        )


# ── Membresía ─────────────────────────────────────────────────────────────────

async def check_membership(
    db:      AsyncSession,
    user_id: UUID,
    club_id: UUID,
) -> tuple[bool, ClubMembership | None]:
    """
    Verifica si el usuario tiene membresía activa en el club.

    Retorna (is_member, membership):
      - is_member=True  únicamente si ClubMembership.status == "APPROVED".
      - membership      el objeto ClubMembership (puede tener cualquier status)
                        o None si no existe ningún registro.

    Prerequisito: todos los usuarios legacy (con user.club_id asignado) deben
    haber sido migrados a ClubMembership APPROVED antes de usar esta función.
    Ver: scripts/migrate_legacy_users.py
    """
    result = await db.execute(
        select(ClubMembership).where(
            ClubMembership.user_id == user_id,
            ClubMembership.club_id == club_id,
        )
    )
    membership = result.scalar_one_or_none()
    is_member  = membership is not None and membership.status == "APPROVED"

    return is_member, membership


# ── Creación central de reservas ──────────────────────────────────────────────

async def create_core_reservation(
    db: AsyncSession,
    *,
    club_id:            UUID,
    court_id:           UUID,
    user_id:            UUID,
    starts_at:          datetime,
    ends_at:            datetime,
    total_price:        float,
    reservation_status: str,
    notes:              str | None = None,
) -> Reservation:
    """
    Crea una reserva, hace commit y maneja IntegrityError por solapamiento.

    Es la única función que llama a db.add() y db.commit() para reservas nuevas.
    El constraint GiST `no_overlap` de PostgreSQL garantiza ausencia de
    solapamientos; esta función lo captura y lo convierte en HTTP 409.

    Los routers solo deben:
      1. Validar permisos (RBAC / membresía).
      2. Parsear y normalizar los datos de entrada.
      3. Llamar a esta función.

    Lanza:
      HTTPException 409 — solapamiento detectado por constraint no_overlap.
      HTTPException 400 — otro IntegrityError inesperado.
    """
    new_res = Reservation(
        club_id=club_id,
        court_id=court_id,
        user_id=user_id,
        starts_at=starts_at,
        ends_at=ends_at,
        total_price=total_price,
        status=reservation_status,
        notes=notes,
    )
    db.add(new_res)

    try:
        await db.commit()
        await db.refresh(new_res)
    except IntegrityError as exc:
        await db.rollback()
        err_msg = str(exc.orig)
        if "no_overlap" in err_msg or "conflicts with existing key" in err_msg:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Ya existe una reserva en ese horario para esta cancha.",
            )
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="No se pudo crear la reserva. Verificá los datos enviados.",
        )

    return new_res
