"""
ClubSystem — Reservations Router
================================
Endpoints:
  GET  /api/v1/reservations/availability   → Grilla completa (canchas + reservas del día).
  GET  /api/v1/reservations/               → Lista plana filtrable por fecha/cancha/estado.
  POST /api/v1/reservations/               → Crear reserva (protegido por constraint GiST).
  PATCH /api/v1/reservations/{id}          → Actualizar estado, monto pagado o notas.
  DELETE /api/v1/reservations/{id}         → Cancelación suave (status → 'cancelled').

Notas de diseño:
  - Timezone: se usa ZoneInfo("America/Argentina/Buenos_Aires") para convertir la fecha
    local a rangos UTC antes de consultar la DB.
    TODO: derivar de Club.timezone cuando ese campo exista en el modelo.
  - Double-booking: el constraint GiST `no_overlap` en la DB rechaza superposiciones.
    El router captura IntegrityError y devuelve HTTP 409 con mensaje descriptivo.
  - RBAC: las escrituras requieren rol OWNER o RESERVATIONS_MANAGER.
    Las lecturas son accesibles a todos los roles autenticados del club.
"""

from collections import defaultdict
from datetime import date, datetime, time, timezone
from uuid import UUID
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator
from sqlalchemy import and_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.club import Club
from app.models.court import Court
from app.models.reservation import Reservation
from app.models.user import User

router = APIRouter()

# ── Timezone ──────────────────────────────────────────────────
# Argentina no cambia hora (UTC-3 fijo). La abstracción ZoneInfo
# permite reemplazar esto por Club.timezone cuando ese campo exista.
_CLUB_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


# ── Schemas ───────────────────────────────────────────────────

class ReservationOut(BaseModel):
    """Representación completa de una reserva para listas y mutaciones."""
    id:          UUID
    court_id:    UUID
    court_name:  str
    user_id:     UUID
    user_name:   str
    status:      str
    starts_at:   datetime
    ends_at:     datetime
    total_price: float
    paid_amount: float
    notes:       Optional[str]

    model_config = {"from_attributes": True}


class SlotReservation(BaseModel):
    """Reserva compacta para incrustar dentro de CourtAvailability."""
    id:          UUID
    user_id:     UUID
    user_name:   str
    status:      str
    starts_at:   datetime
    ends_at:     datetime
    total_price: float
    paid_amount: float
    notes:       Optional[str]


class CourtAvailability(BaseModel):
    """Cancha con todas sus reservas no canceladas del día solicitado."""
    id:           UUID
    name:         str
    sport:        str
    surface:      Optional[str]
    is_indoor:    bool
    capacity:     int
    hourly_rate:  float
    reservations: list[SlotReservation]


class AvailabilityResponse(BaseModel):
    """Respuesta completa para la grilla de reservas."""
    date:   date
    courts: list[CourtAvailability]


class ReservationCreate(BaseModel):
    court_id:    UUID
    user_id:     UUID
    starts_at:   datetime
    ends_at:     datetime
    total_price: float = 0.0
    notes:       Optional[str] = None

    @model_validator(mode="after")
    def validate_times(self) -> "ReservationCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at debe ser posterior a starts_at.")
        return self


class ReservationUpdate(BaseModel):
    """Todos los campos son opcionales — PATCH semántico."""
    status:      Optional[str]   = None
    paid_amount: Optional[float] = None
    notes:       Optional[str]   = None

    @model_validator(mode="after")
    def validate_status(self) -> "ReservationUpdate":
        valid = {"pending", "confirmed", "cancelled", "completed"}
        if self.status is not None and self.status not in valid:
            raise ValueError(f"status debe ser uno de: {sorted(valid)}")
        return self


# ── Helpers privados ──────────────────────────────────────────

def _day_utc_bounds(day: date) -> tuple[datetime, datetime]:
    """
    Convierte una fecha local (Argentina) a un rango UTC start/end.
    Ejemplo: 2026-03-17 ART → (2026-03-17T03:00:00Z, 2026-03-18T02:59:59.999999Z)

    Sin esto, una reserva a las 00:30 ART (03:30 UTC) quedaría fuera
    del rango si se consultara con naive UTC midnight boundaries.
    """
    local_start = datetime.combine(day, time.min, tzinfo=_CLUB_TZ)
    local_end   = datetime.combine(day, time.max, tzinfo=_CLUB_TZ)
    return (
        local_start.astimezone(timezone.utc),
        local_end.astimezone(timezone.utc),
    )


def _build_out(r: Reservation, court_name: str, user_name: str) -> ReservationOut:
    """Construye ReservationOut desde un ORM object + nombres ya resueltos."""
    return ReservationOut(
        id=r.id,
        court_id=r.court_id,
        court_name=court_name,
        user_id=r.user_id,
        user_name=user_name,
        status=r.status,
        starts_at=r.starts_at,
        ends_at=r.ends_at,
        total_price=float(r.total_price),
        paid_amount=float(r.paid_amount),
        notes=r.notes,
    )


async def _auto_transition_past(db: AsyncSession, club_id: UUID) -> None:
    """
    Transiciona reservas pasadas a su estado final:
      - confirmed + ends_at  <= ahora → completed  (registro histórico)
      - pending  + starts_at <= ahora → cancelled   (nunca fue confirmada)

    Se llama al inicio de cada GET para mantener la DB consistente
    sin necesitar un worker de background (Celery / APScheduler).
    """
    now = datetime.now(timezone.utc)

    await db.execute(
        update(Reservation)
        .where(
            Reservation.club_id == club_id,
            Reservation.status  == "confirmed",
            Reservation.ends_at <= now,
        )
        .values(status="completed")
    )

    await db.execute(
        update(Reservation)
        .where(
            Reservation.club_id  == club_id,
            Reservation.status   == "pending",
            Reservation.starts_at <= now,
        )
        .values(status="cancelled", cancelled_at=now)
    )

    await db.commit()


async def _get_reservation_or_404(
    db: AsyncSession,
    reservation_id: UUID,
    club_id: UUID,
) -> Reservation:
    """Carga una reserva validando que pertenezca al club activo."""
    res = await db.get(Reservation, reservation_id)
    if not res or res.club_id != club_id:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    return res


# ── GET /availability ─────────────────────────────────────────

@router.get("/availability", response_model=AvailabilityResponse)
async def get_availability(
    target_date: date = Query(
        default_factory=date.today,
        description="Fecha local YYYY-MM-DD. Default: hoy.",
    ),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityResponse:
    """
    Grilla completa del día: retorna todas las canchas activas del club
    con sus reservas no canceladas ya agrupadas por cancha.

    Un único request reemplaza los dos calls paralelos (GET /courts + GET /reservations)
    que el frontend usa para construir la tabla horaria, reduciendo latencia
    y eliminando la necesidad de join en el cliente.
    """
    await _auto_transition_past(db, club_id)
    day_start, day_end = _day_utc_bounds(target_date)

    # 1. Canchas activas del club — ordenadas por nombre para grilla estable
    courts_result = await db.execute(
        select(Court)
        .where(Court.club_id == club_id, Court.is_active.is_(True))
        .order_by(Court.name)
    )
    courts = courts_result.scalars().all()

    if not courts:
        return AvailabilityResponse(date=target_date, courts=[])

    court_ids = [c.id for c in courts]

    # 2. Reservas no canceladas del día para esas canchas (join con User para nombre)
    res_result = await db.execute(
        select(Reservation, User)
        .join(User, User.id == Reservation.user_id)
        .where(
            and_(
                Reservation.club_id   == club_id,
                Reservation.court_id.in_(court_ids),
                Reservation.status    != "cancelled",
                Reservation.starts_at >= day_start,
                Reservation.starts_at <= day_end,
            )
        )
        .order_by(Reservation.starts_at)
    )
    res_rows = res_result.all()

    # 3. Agrupar por court_id en O(n) — evita N+1 queries
    res_by_court: dict[UUID, list[SlotReservation]] = defaultdict(list)
    for res, user in res_rows:
        res_by_court[res.court_id].append(
            SlotReservation(
                id=res.id,
                user_id=res.user_id,
                user_name=f"{user.first_name} {user.last_name}",
                status=res.status,
                starts_at=res.starts_at,
                ends_at=res.ends_at,
                total_price=float(res.total_price),
                paid_amount=float(res.paid_amount),
                notes=res.notes,
            )
        )

    # 4. Ensamblar respuesta — canchas sin reservas reciben lista vacía
    return AvailabilityResponse(
        date=target_date,
        courts=[
            CourtAvailability(
                id=c.id,
                name=c.name,
                sport=c.sport,
                surface=c.surface,
                is_indoor=c.is_indoor,
                capacity=c.capacity,
                hourly_rate=float(c.hourly_rate),
                reservations=res_by_court[c.id],
            )
            for c in courts
        ],
    )


# ── GET / ─────────────────────────────────────────────────────

@router.get("/", response_model=list[ReservationOut])
async def list_reservations(
    target_date: Optional[date] = Query(
        None,
        description="Fecha local YYYY-MM-DD. Default: hoy.",
    ),
    court_id:  Optional[UUID] = Query(None),
    status:    Optional[str]  = Query(None),
    all_dates: bool = Query(
        False,
        description="Si True, ignora target_date y devuelve todas las fechas. "
                    "Útil para la vista de historial global.",
    ),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> list[ReservationOut]:
    """
    Lista plana de reservas con filtros opcionales.
    - Sin all_dates: filtra por target_date (o hoy si omitido).
    - Con all_dates=true: devuelve todas las fechas del club (sin límite temporal),
      ordenadas por starts_at DESC — ideal para el historial de turnos completados.
    """
    await _auto_transition_past(db, club_id)

    q = (
        select(Reservation, Court, User)
        .join(Court, Court.id == Reservation.court_id)
        .join(User,  User.id  == Reservation.user_id)
        .where(Reservation.club_id == club_id)
    )

    if not all_dates:
        day = target_date or date.today()
        day_start, day_end = _day_utc_bounds(day)
        q = q.where(
            and_(
                Reservation.starts_at >= day_start,
                Reservation.starts_at <= day_end,
            )
        )

    if court_id:
        q = q.where(Reservation.court_id == court_id)
    if status:
        q = q.where(Reservation.status == status)

    order = Reservation.starts_at.desc() if all_dates else Reservation.starts_at
    result = await db.execute(q.order_by(order))
    return [
        _build_out(r, c.name, f"{u.first_name} {u.last_name}")
        for r, c, u in result.all()
    ]


# ── POST / ────────────────────────────────────────────────────

@router.post("/", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreate,
    club_id: UUID = Depends(get_current_club_id),
    _role:   str  = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> ReservationOut:
    """
    Crea una nueva reserva.

    El constraint GiST `no_overlap` de PostgreSQL garantiza que no haya
    superposición de horarios por cancha con status != 'cancelled'.
    Si hay conflicto, la DB lanza un IntegrityError → HTTP 409.
    """
    # Verificar que la cancha pertenece al club activo
    court = await db.get(Court, payload.court_id)
    if not court or court.club_id != club_id:
        raise HTTPException(status_code=404, detail="Cancha no encontrada en este club.")

    # Verificar que el usuario pertenece al club activo
    user = await db.get(User, payload.user_id)
    if not user or user.club_id != club_id:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en este club.")

    # ── Validación de horario operativo del club ───────────────────────────────
    # Reglas de negocio:
    #   · starts_at >= open_time  del club
    #   · ends_at   <= close_time del club
    # Solo se aplica cuando el club tiene ambos horarios configurados y
    # representan un turno dentro del mismo día (open_time < close_time).
    #
    # Diseño:
    #   Se construyen datetimes límite completos (open_bound / close_bound)
    #   sobre la fecha local de inicio de la reserva.  Esto evita dos bugs
    #   del enfoque naïve de extraer solo .time():
    #
    #   1. Rollover de medianoche: una reserva que termine a las 00:30 del día
    #      siguiente tendría ends_local.time() == 00:30, que es MENOR que
    #      close_time == 21:00 → la comparación aceptaría un horario inválido.
    #
    #   2. Datetime naive: si el cliente omite el offset de zona horaria,
    #      .astimezone() asume la TZ del sistema (UTC en producción), no ART,
    #      desplazando la comparación 3 horas y permitiendo reservas fuera de
    #      horario que deberían rechazarse.
    club = await db.get(Club, club_id)
    if club and club.open_time and club.close_time and club.open_time < club.close_time:
        # Normalizar a timezone-aware: si llega sin offset, asumir hora local
        # del club (America/Argentina/Buenos_Aires, UTC-3 fijo).
        def _to_aware(dt: datetime) -> datetime:
            return dt if dt.tzinfo is not None else dt.replace(tzinfo=_CLUB_TZ)

        starts_aware = _to_aware(payload.starts_at)
        ends_aware   = _to_aware(payload.ends_at)

        # Proyectar open/close sobre la fecha local de inicio.
        # Usar datetime.combine garantiza que la comparación sea entre objetos
        # del mismo tipo y referencia temporal, sin perder el contexto de fecha.
        local_date  = starts_aware.astimezone(_CLUB_TZ).date()
        open_bound  = datetime.combine(local_date, club.open_time,  tzinfo=_CLUB_TZ)
        close_bound = datetime.combine(local_date, club.close_time, tzinfo=_CLUB_TZ)

        if starts_aware < open_bound or ends_aware > close_bound:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El horario de la reserva está fuera del horario de operación del club.",
            )

    # El administrador crea la reserva directamente como "confirmed".
    # Un socio que reserve por autogestión (futuro) recibiría "pending".
    new_res = Reservation(
        club_id=club_id,
        court_id=payload.court_id,
        user_id=payload.user_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        total_price=payload.total_price,
        notes=payload.notes,
        status="confirmed",
    )
    db.add(new_res)

    try:
        await db.commit()
        await db.refresh(new_res)
    except IntegrityError as exc:
        await db.rollback()
        err_msg = str(exc.orig)
        # Nombre del constraint GiST definido en 01_schema.sql
        if "no_overlap" in err_msg or "conflicts with existing key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una reserva en ese horario para esta cancha.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo crear la reserva. Verificá los datos enviados.",
        )

    return _build_out(new_res, court.name, f"{user.first_name} {user.last_name}")


# ── PATCH /{id} ───────────────────────────────────────────────

@router.patch("/{reservation_id}", response_model=ReservationOut)
async def update_reservation(
    reservation_id: UUID,
    payload: ReservationUpdate,
    club_id: UUID = Depends(get_current_club_id),
    _role:   str  = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> ReservationOut:
    """
    Actualiza parcialmente una reserva (estado, monto pagado o notas).
    No se puede modificar una reserva ya cancelada.
    """
    res = await _get_reservation_or_404(db, reservation_id, club_id)

    if res.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una reserva ya cancelada.",
        )

    if payload.status is not None:
        res.status = payload.status
        if payload.status == "cancelled":
            res.cancelled_at = datetime.now(timezone.utc)

    if payload.paid_amount is not None:
        if payload.paid_amount < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="paid_amount no puede ser negativo.",
            )
        res.paid_amount = payload.paid_amount

    if payload.notes is not None:
        res.notes = payload.notes

    await db.commit()
    await db.refresh(res)

    court = await db.get(Court, res.court_id)
    user  = await db.get(User,  res.user_id)
    return _build_out(
        res,
        court.name if court else "",
        f"{user.first_name} {user.last_name}" if user else "",
    )


# ── DELETE /{id} ──────────────────────────────────────────────

@router.delete("/{reservation_id}", status_code=status.HTTP_200_OK)
async def cancel_reservation(
    reservation_id: UUID,
    club_id: UUID = Depends(get_current_club_id),
    _role:   str  = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Cancelación suave: pone status = 'cancelled' sin eliminar la fila.

    Por qué soft-delete:
    - El constraint GiST filtra `status != 'cancelled'`, por lo que cancelar
      libera el slot para nuevas reservas sin perder historial.
    - Una eliminación física rompería el audit trail y las FK de caja/expenses.
    """
    res = await _get_reservation_or_404(db, reservation_id, club_id)

    if res.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La reserva ya está cancelada.",
        )

    res.status       = "cancelled"
    res.cancelled_at = datetime.now(timezone.utc)

    await db.commit()

    return {"ok": True, "reservation_id": str(reservation_id)}
