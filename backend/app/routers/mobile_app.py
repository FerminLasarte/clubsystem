"""
ClubSystem — Mobile App Router (Portal del Jugador)
====================================================
Endpoints dedicados para la app móvil del socio (jugador).
Aislados del panel de administración para evolucionar independientemente.

Rutas:
  POST /api/v1/mobile/auth/login      → Autenticación de socios por email o DNI.
  GET  /api/v1/mobile/reservations/me → Reservas futuras del socio autenticado.

Notas:
  - El JWT emitido usa club_id del usuario y roles=[] (sin roles de staff).
  - get_current_user_id valida el token y extrae el sub (UUID del user).
  - Las reservas se filtran por starts_at > NOW() y status != 'cancelled'.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.middleware.tenant import get_current_user_id
from app.models.club import Club
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
