"""
ClubSystem — Mobile App Router (Portal del Jugador)
====================================================
Endpoints dedicados para la app móvil del socio (jugador).
Aislados del panel de administración para evolucionar independientemente.

Rutas:
  POST /api/v1/mobile/auth/login          → Autenticación de socios por email o DNI.
  GET  /api/v1/mobile/reservations/me     → Reservas futuras del socio autenticado.
  GET  /api/v1/mobile/clubs/{id}/courts   → Canchas del club con precio diferencial
                                            (price_member si es socio APPROVED,
                                             price_guest si es visitante/PENDING).

Notas:
  - El JWT emitido usa club_id del usuario y roles=[] (sin roles de staff).
  - get_current_user_id valida el token y extrae el sub (UUID del user).
  - Las reservas se filtran por starts_at > NOW() y status != 'cancelled'.
"""

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.middleware.tenant import get_current_user_id
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.court import Court
from app.models.reservation import Reservation
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class MemberLoginRequest(BaseModel):
    """
    Credenciales de acceso del socio.
    `identifier` acepta email o DNI (número de documento).
    """
    identifier: str
    password: str


class MemberOut(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    member_number: str | None = None
    club_id: UUID | None = None
    club_name: str | None = None

    class Config:
        from_attributes = True


class MobileAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut


class ReservationMeOut(BaseModel):
    id: UUID
    court_name: str
    sport: str
    starts_at: datetime
    ends_at: datetime
    status: str
    total_price: float

    class Config:
        from_attributes = True


class UserMembershipOut(BaseModel):
    club_id:            UUID
    club_name:          str
    status:             str          # PENDING | APPROVED | REJECTED
    membership_plan_id: Optional[str]
    request_date:       datetime

    model_config = {"from_attributes": False}


class ClubDirectoryOut(BaseModel):
    id:            UUID
    name:          str
    sport_types:   list[str]
    logo_url:      Optional[str]
    primary_color: str
    address:       Optional[str]
    city:          Optional[str]

    model_config = {"from_attributes": True}


class CourtMobileOut(BaseModel):
    """
    Cancha con precio adaptado al tipo de usuario:
      - is_member=True  → price = price_member (o hourly_rate si no está configurado)
      - is_member=False → price = price_guest  (o hourly_rate si no está configurado)
    """
    id:          UUID
    name:        str
    sport:       str
    surface:     Optional[str]
    is_indoor:   bool
    capacity:    int
    description: Optional[str]
    image_url:   Optional[str]
    # Precio resuelto según membresía del usuario en este club
    price:       float
    is_member:   bool

    model_config = {"from_attributes": False}


class TimeSlotOut(BaseModel):
    """Franja horaria con disponibilidad y precio resuelto."""
    start_time:   str    # "09:00"
    end_time:     str    # "10:00"
    is_available: bool
    price:        float


class CourtAvailabilityMobileOut(BaseModel):
    court_id:   UUID
    court_name: str
    sport:      str
    date:       str      # "2026-03-23"
    is_member:  bool
    slots:      list[TimeSlotOut]


class MobileReservationCreate(BaseModel):
    court_id:   UUID
    date:       str    # "YYYY-MM-DD"
    start_time: str    # "HH:MM"
    duration:   int = 60   # minutos


class MobileReservationOut(BaseModel):
    id:          UUID
    court_name:  str
    sport:       str
    starts_at:   datetime
    ends_at:     datetime
    status:      str
    total_price: float


# ── Constantes de timezone ─────────────────────────────────────────────────────

_MOBILE_TZ     = ZoneInfo("America/Argentina/Buenos_Aires")
_DEFAULT_OPEN  = time(8,  0)
_DEFAULT_CLOSE = time(22, 0)


# ── Helper: generar slots ──────────────────────────────────────────────────────

def _generate_slots(
    open_t:   time,
    close_t:  time,
    duration: int,
) -> list[tuple[time, time]]:
    """Genera pares (start, end) de `duration` minutos desde open_t hasta close_t."""
    base     = datetime(2000, 1, 1)
    current  = datetime.combine(base, open_t)
    close_dt = datetime.combine(base, close_t)
    delta    = timedelta(minutes=duration)
    slots: list[tuple[time, time]] = []
    while current + delta <= close_dt:
        slots.append((current.time(), (current + delta).time()))
        current += delta
    return slots


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=MobileAuthResponse)
async def member_login(
    body: MemberLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> MobileAuthResponse:
    """
    Autentica a un socio por email o DNI y devuelve un JWT + datos del miembro.

    Flujo:
      1. Normaliza el identificador a minúsculas.
      2. Busca el usuario por email (case-insensitive) o por DNI exacto.
      3. Verifica la contraseña con bcrypt.
      4. Verifica que la cuenta esté activa.
      5. Emite un JWT con club_id y roles=[] (no es staff del panel).
      6. Retorna el token y los datos básicos del miembro.
    """
    identifier_lower = body.identifier.strip().lower()

    stmt = select(User).where(
        (User.email == identifier_lower)
        | (User.dni == body.identifier.strip())
    )
    result = await db.execute(stmt)
    user: User | None = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        logger.warning(
            "Mobile login fallido para identifier='%s'", body.identifier.strip()
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    if not user.is_active:
        logger.warning("Mobile login denegado: cuenta inactiva user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta inactiva. Contactá a tu club.",
        )

    # Obtener el nombre del club si el socio tiene uno asignado
    club_name: str | None = None
    if user.club_id is not None:
        club_result = await db.execute(
            select(Club).where(Club.id == user.club_id)
        )
        club = club_result.scalar_one_or_none()
        club_name = club.name if club else None

    token = create_access_token(
        sub=str(user.id),
        email=user.email,
        club_id=user.club_id,
        roles=[],
    )

    logger.info("Mobile login exitoso para user_id=%s", user.id)

    return MobileAuthResponse(
        access_token=token,
        member=MemberOut(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            member_number=user.member_number,
            club_id=user.club_id,
            club_name=club_name,
        ),
    )


# ── GET /reservations/me ──────────────────────────────────────────────────────

@router.get("/reservations/me", response_model=list[ReservationMeOut])
async def get_my_reservations(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ReservationMeOut]:
    """
    Devuelve las reservas futuras del socio autenticado.

    Filtros:
      - user_id  = usuario del JWT
      - starts_at > ahora (UTC)
      - status   != 'cancelled'

    Resultado ordenado por starts_at ascendente (próximas primero).
    """
    now = datetime.now(timezone.utc)

    stmt = (
        select(Reservation, Court)
        .join(Court, Reservation.court_id == Court.id)
        .where(
            Reservation.user_id == user_id,
            Reservation.starts_at > now,
            Reservation.status != "cancelled",
        )
        .order_by(Reservation.starts_at.asc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    logger.info(
        "Reservas futuras: %d encontradas para user_id=%s", len(rows), user_id
    )

    return [
        ReservationMeOut(
            id=reservation.id,
            court_name=court.name,
            sport=court.sport,
            starts_at=reservation.starts_at,
            ends_at=reservation.ends_at,
            status=reservation.status,
            total_price=float(reservation.total_price),
        )
        for reservation, court in rows
    ]


# ── GET /memberships/me — membresías del usuario autenticado ─────────────

@router.get(
    "/memberships/me",
    response_model=list[UserMembershipOut],
    summary="Membresías del usuario en todos los clubs",
)
async def get_my_memberships(
    user_id: UUID         = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
) -> list[UserMembershipOut]:
    """
    Devuelve todas las membresías del usuario autenticado, cruzadas con el
    nombre del club. Ordenadas por fecha de solicitud descendente.
    """
    stmt = (
        select(ClubMembership, Club)
        .join(Club, ClubMembership.club_id == Club.id)
        .where(ClubMembership.user_id == user_id)
        .order_by(ClubMembership.request_date.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    logger.info("get_my_memberships | user_id=%s count=%d", user_id, len(rows))

    return [
        UserMembershipOut(
            club_id=membership.club_id,
            club_name=club.name,
            status=membership.status,
            membership_plan_id=membership.membership_plan_id,
            request_date=membership.request_date,
        )
        for membership, club in rows
    ]


# ── GET /clubs — directorio público de clubs ──────────────────────────────

@router.get(
    "/clubs",
    response_model=list[ClubDirectoryOut],
    summary="Directorio de clubs disponibles",
)
async def list_clubs_directory(
    user_id: UUID         = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
) -> list[ClubDirectoryOut]:
    """
    Devuelve todos los clubs activos para que el usuario pueda descubrir
    clubs y solicitar membresía. Requiere JWT válido (cualquier usuario).
    """
    result = await db.execute(
        select(Club)
        .where(Club.is_active == True)  # noqa: E712
        .order_by(Club.name)
    )
    clubs = result.scalars().all()
    logger.info("list_clubs_directory | user_id=%s clubs=%d", user_id, len(clubs))
    return clubs  # type: ignore[return-value]


# ── GET /clubs/{club_id}/courts — canchas con precio diferencial ───────────

@router.get(
    "/clubs/{club_id}/courts",
    response_model=list[CourtMobileOut],
    summary="Canchas del club con precio adaptado al tipo de usuario",
)
async def get_club_courts_for_member(
    club_id: UUID,
    user_id: UUID         = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
) -> list[CourtMobileOut]:
    """
    Devuelve las canchas activas del club con el precio correcto según membresía.

    Lógica:
      1. Verifica que el club exista y esté activo.
      2. Busca ClubMembership del usuario para este club.
      3. Si status == APPROVED → is_member=True  → usa price_member (fallback: hourly_rate).
         Si no existe o status != APPROVED → is_member=False → usa price_guest (fallback: hourly_rate).
      4. Devuelve lista de canchas con el campo `price` ya resuelto.
    """
    # 1. Verificar club
    club = await db.get(Club, club_id)
    if not club or not club.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Club no encontrado o inactivo",
        )

    # 2. Verificar membresía del usuario en este club
    membership_result = await db.execute(
        select(ClubMembership).where(
            ClubMembership.user_id == user_id,
            ClubMembership.club_id == club_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    is_member  = membership is not None and membership.status == "APPROVED"

    # Fallback legacy: usuario con club_id directo asignado (sin ClubMembership)
    if not is_member:
        user_obj = await db.get(User, user_id)
        if user_obj and user_obj.club_id == club_id:
            is_member = True

    # 3. Obtener canchas activas del club
    courts_result = await db.execute(
        select(Court)
        .where(Court.club_id == club_id, Court.is_active == True)  # noqa: E712
        .order_by(Court.name)
    )
    courts = courts_result.scalars().all()

    logger.info(
        "get_club_courts_for_member | club_id=%s user_id=%s is_member=%s courts=%d",
        club_id, user_id, is_member, len(courts),
    )

    # 4. Resolver precio según tipo de usuario
    result = []
    for court in courts:
        if is_member:
            price = float(court.price_member if court.price_member is not None else court.hourly_rate)
        else:
            price = float(court.price_guest  if court.price_guest  is not None else court.hourly_rate)

        result.append(
            CourtMobileOut(
                id=court.id,
                name=court.name,
                sport=court.sport,
                surface=court.surface,
                is_indoor=court.is_indoor,
                capacity=court.capacity,
                description=court.description,
                image_url=court.image_url,
                price=price,
                is_member=is_member,
            )
        )

    return result


# ── GET /courts/{court_id}/availability ───────────────────────────────────────

@router.get(
    "/courts/{court_id}/availability",
    response_model=CourtAvailabilityMobileOut,
    summary="Franjas horarias disponibles para una cancha en una fecha",
)
async def get_court_availability(
    court_id: UUID,
    date:     str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    duration: int = Query(60, ge=30, le=240, description="Duración en minutos"),
    user_id:  UUID         = Depends(get_current_user_id),
    db:       AsyncSession = Depends(get_db),
) -> CourtAvailabilityMobileOut:
    """
    Devuelve todos los slots del día para la cancha indicada.

    Lógica:
      1. Obtiene la cancha y el club (para horario operativo).
      2. Verifica si el usuario es APPROVED member para calcular precio.
      3. Genera slots de `duration` minutos entre open_time y close_time.
      4. Cruza con reservas no canceladas para marcar ocupados.
      5. Slots cuyo inicio ya pasó → is_available=False.
    """
    # 1. Obtener cancha
    court = await db.get(Court, court_id)
    if not court or not court.is_active:
        raise HTTPException(status_code=404, detail="Cancha no encontrada o inactiva.")

    # 2. Obtener club
    club = await db.get(Club, court.club_id)
    if not club or not club.is_active:
        raise HTTPException(status_code=404, detail="Club no encontrado o inactivo.")

    # 3. Verificar membresía del usuario
    membership_result = await db.execute(
        select(ClubMembership).where(
            ClubMembership.user_id == user_id,
            ClubMembership.club_id == court.club_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    is_member  = membership is not None and membership.status == "APPROVED"

    # Fallback legacy: si el usuario tiene club_id igual al de la cancha, es "miembro"
    if not is_member:
        user = await db.get(User, user_id)
        if user and user.club_id == court.club_id:
            is_member = True

    # 4. Precio según tipo de usuario
    price = float(
        (court.price_member if court.price_member is not None else court.hourly_rate)
        if is_member else
        (court.price_guest  if court.price_guest  is not None else court.hourly_rate)
    )
    # Ajustar precio por duración (hourly → por slot)
    price = price * duration / 60.0

    # 5. Parsear fecha
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD.")

    # 6. Horario operativo del club (fallback defaults si no está configurado)
    open_t  = club.open_time  if (club.open_time  and club.close_time and club.open_time < club.close_time) else _DEFAULT_OPEN
    close_t = club.close_time if (club.open_time  and club.close_time and club.open_time < club.close_time) else _DEFAULT_CLOSE

    # 7. Generar slots
    raw_slots = _generate_slots(open_t, close_t, duration)

    # 8. Reservas no canceladas del día para esta cancha
    day_start = datetime.combine(target_date, time.min, tzinfo=_MOBILE_TZ).astimezone(timezone.utc)
    day_end   = datetime.combine(target_date, time.max, tzinfo=_MOBILE_TZ).astimezone(timezone.utc)

    res_result = await db.execute(
        select(Reservation).where(
            Reservation.court_id  == court_id,
            Reservation.status    != "cancelled",
            Reservation.starts_at >= day_start,
            Reservation.starts_at <  day_end,
        )
    )
    existing = res_result.scalars().all()

    # 9. Cruzar slots con reservas existentes
    now_utc  = datetime.now(timezone.utc)
    slots_out: list[TimeSlotOut] = []

    for slot_start, slot_end in raw_slots:
        start_utc = datetime.combine(target_date, slot_start, tzinfo=_MOBILE_TZ).astimezone(timezone.utc)
        end_utc   = datetime.combine(target_date, slot_end,   tzinfo=_MOBILE_TZ).astimezone(timezone.utc)

        # Slot pasado → no disponible
        if start_utc <= now_utc:
            is_available = False
        else:
            # Overlap: cualquier reserva que se superponga (inicio < fin_slot AND fin > inicio_slot)
            is_available = not any(
                r.starts_at < end_utc and r.ends_at > start_utc
                for r in existing
            )

        slots_out.append(TimeSlotOut(
            start_time=slot_start.strftime("%H:%M"),
            end_time=slot_end.strftime("%H:%M"),
            is_available=is_available,
            price=price,
        ))

    logger.info(
        "get_court_availability | court_id=%s date=%s duration=%d slots=%d",
        court_id, date, duration, len(slots_out),
    )

    return CourtAvailabilityMobileOut(
        court_id=court_id,
        court_name=court.name,
        sport=court.sport,
        date=date,
        is_member=is_member,
        slots=slots_out,
    )


# ── POST /reservations — autogestión del socio ────────────────────────────────

@router.post(
    "/reservations",
    response_model=MobileReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear reserva desde la app del socio",
)
async def create_mobile_reservation(
    payload: MobileReservationCreate,
    user_id: UUID         = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
) -> MobileReservationOut:
    """
    El socio crea una reserva desde la app (autogestión).

    Diferencias respecto al endpoint de admin (POST /api/v1/reservations/):
      - Requiere JWT de socio (get_current_user_id), no rol de staff.
      - Verifica que el usuario tenga membresía APPROVED (o legacy club_id).
      - Crea la reserva con status="pending" (el admin puede confirmar luego).
      - Calcula el precio según tipo de usuario y duración.
    """
    # 1. Obtener cancha
    court = await db.get(Court, payload.court_id)
    if not court or not court.is_active:
        raise HTTPException(status_code=404, detail="Cancha no encontrada o inactiva.")

    # 2. Verificar acceso: APPROVED membership o legacy club_id
    membership_result = await db.execute(
        select(ClubMembership).where(
            ClubMembership.user_id == user_id,
            ClubMembership.club_id == court.club_id,
            ClubMembership.status  == "APPROVED",
        )
    )
    membership = membership_result.scalar_one_or_none()

    if membership is None:
        user = await db.get(User, user_id)
        if not user or user.club_id != court.club_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés membresía activa en este club.",
            )

    # 3. Parsear fecha y hora de inicio
    try:
        target_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
        h, m = (int(x) for x in payload.start_time.split(":"))
        starts_local = datetime.combine(target_date, time(h, m), tzinfo=_MOBILE_TZ)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Formato de fecha/hora inválido.")

    ends_local = starts_local + timedelta(minutes=payload.duration)
    starts_at  = starts_local.astimezone(timezone.utc)
    ends_at    = ends_local.astimezone(timezone.utc)

    # 4. No reservar en el pasado
    if starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="No podés reservar en el pasado.")

    # 5. Validar horario operativo del club
    club = await db.get(Club, court.club_id)
    if club and club.open_time and club.close_time and club.open_time < club.close_time:
        local_date  = starts_local.date()
        open_bound  = datetime.combine(local_date, club.open_time,  tzinfo=_MOBILE_TZ)
        close_bound = datetime.combine(local_date, club.close_time, tzinfo=_MOBILE_TZ)
        if starts_local < open_bound or ends_local > close_bound:
            raise HTTPException(
                status_code=400,
                detail="El horario está fuera del horario operativo del club.",
            )

    # 6. Calcular precio
    is_member = membership is not None
    base_price = float(
        (court.price_member if court.price_member is not None else court.hourly_rate)
        if is_member else
        (court.price_guest  if court.price_guest  is not None else court.hourly_rate)
    )
    total_price = base_price * payload.duration / 60.0

    # 7. Crear reserva (status="pending" — el admin confirma)
    new_res = Reservation(
        club_id=court.club_id,
        court_id=payload.court_id,
        user_id=user_id,
        starts_at=starts_at,
        ends_at=ends_at,
        total_price=total_price,
        status="pending",
    )
    db.add(new_res)

    try:
        await db.commit()
        await db.refresh(new_res)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una reserva en ese horario para esta cancha.",
        )

    logger.info(
        "create_mobile_reservation | user_id=%s court_id=%s starts_at=%s price=%.2f",
        user_id, payload.court_id, starts_at, total_price,
    )

    return MobileReservationOut(
        id=new_res.id,
        court_name=court.name,
        sport=court.sport,
        starts_at=new_res.starts_at,
        ends_at=new_res.ends_at,
        status=new_res.status,
        total_price=total_price,
    )
