"""
ClubSystem — Settings Router
===========================
Endpoint unificado de configuración para el panel de administración.

  GET /api/v1/settings  → Devuelve perfil del admin, config del club, pagos y notificaciones.
  PUT /api/v1/settings  → Actualiza los campos enviados. Solo OWNER.

Seguridad:
  - GET: cualquier rol autenticado del club.
  - PUT: require_role("OWNER") — lanza 403 si el rol no coincide.

Perfil:
  El perfil se construye leyendo el registro ClubStaff del usuario logueado
  (identificado por el JWT sub → User.id) y, si existe el link user_id,
  se complementa con first_name + last_name del modelo User.
"""

import logging
from datetime import time as dt_time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, get_current_user_id, require_role
from app.models.club import Club
from app.models.club_staff import ClubStaff
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Output schemas ─────────────────────────────────────────────────────────────


class ProfileOut(BaseModel):
    fullName:  str
    email:     str
    avatarUrl: str | None = None


class ClubConfigOut(BaseModel):
    name:                    str
    phone:                   str | None = None
    address:                 str | None = None
    city:                    str | None = None
    openTime:                str | None = None
    closeTime:               str | None = None
    cancellationPolicyHours: int = 24


class PaymentsOut(BaseModel):
    requireDeposit:   bool = False
    mercadopagoToken: str  = ""


class NotificationsOut(BaseModel):
    whatsappNewReservations: bool = True
    cancellationAlerts:      bool = True
    dailyCashReport:         bool = False


class SettingsOut(BaseModel):
    profile:       ProfileOut
    club:          ClubConfigOut
    payments:      PaymentsOut
    notifications: NotificationsOut


# ── Update schemas ─────────────────────────────────────────────────────────────


class ProfileUpdate(BaseModel):
    fullName: str | None = None


class ClubConfigUpdate(BaseModel):
    name:                    str | None = None
    phone:                   str | None = None
    address:                 str | None = None
    city:                    str | None = None
    openTime:                str | None = None   # "HH:MM" o null para limpiar
    closeTime:               str | None = None   # "HH:MM" o null para limpiar
    cancellationPolicyHours: int | None = None


class PaymentsUpdate(BaseModel):
    requireDeposit:   bool | None = None
    mercadopagoToken: str | None  = None


class NotificationsUpdate(BaseModel):
    whatsappNewReservations: bool | None = None
    cancellationAlerts:      bool | None = None
    dailyCashReport:         bool | None = None


class SettingsUpdate(BaseModel):
    profile:       ProfileUpdate       | None = None
    club:          ClubConfigUpdate    | None = None
    payments:      PaymentsUpdate      | None = None
    notifications: NotificationsUpdate | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────


def _time_to_str(t: dt_time | None) -> str | None:
    return t.strftime("%H:%M") if t else None


def _str_to_time(s: str | None) -> dt_time | None:
    if not s:
        return None
    try:
        h, m = s.split(":", 1)
        return dt_time(int(h), int(m))
    except (ValueError, TypeError):
        return None


async def _build_settings(club: Club, club_id: UUID, user_id: UUID, db: AsyncSession) -> SettingsOut:
    """Construye el SettingsOut leyendo club + perfil del admin logueado."""

    # ── Perfil del operador ───────────────────────────────────────────────────
    staff_result = await db.execute(
        select(ClubStaff).where(
            ClubStaff.club_id == club_id,
            ClubStaff.user_id == user_id,
        )
    )
    staff = staff_result.scalar_one_or_none()

    full_name   = ""
    admin_email = staff.email if staff else ""
    avatar_url  = None

    if staff and staff.user_id:
        user = await db.get(User, staff.user_id)
        if user:
            full_name  = f"{user.first_name} {user.last_name}".strip()
            avatar_url = getattr(user, "avatar_url", None)

    if not full_name and admin_email:
        # Fallback: derivar nombre del prefijo del email
        full_name = admin_email.split("@")[0].replace(".", " ").replace("_", " ").title()

    return SettingsOut(
        profile=ProfileOut(
            fullName  = full_name,
            email     = admin_email,
            avatarUrl = avatar_url,
        ),
        club=ClubConfigOut(
            name                    = club.name,
            phone                   = club.phone,
            address                 = club.address,
            city                    = club.city,
            openTime                = _time_to_str(club.open_time),
            closeTime               = _time_to_str(club.close_time),
            cancellationPolicyHours = club.cancellation_policy_hours,
        ),
        payments=PaymentsOut(
            requireDeposit   = getattr(club, "require_deposit",   False),
            mercadopagoToken = getattr(club, "mercadopago_token", "") or "",
        ),
        notifications=NotificationsOut(
            whatsappNewReservations = getattr(club, "notif_whatsapp",     True),
            cancellationAlerts      = getattr(club, "notif_cancellation", True),
            dailyCashReport         = getattr(club, "notif_cash_report",  False),
        ),
    )


# ── GET /settings ──────────────────────────────────────────────────────────────


@router.get("/", response_model=SettingsOut)
async def get_settings(
    club_id: UUID          = Depends(get_current_club_id),
    user_id: UUID          = Depends(get_current_user_id),
    db:      AsyncSession  = Depends(get_db),
) -> SettingsOut:
    """
    Devuelve la configuración completa del club para la pantalla de Ajustes.
    Accesible para cualquier miembro autenticado del club.
    """
    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado.")

    return await _build_settings(club, club_id, user_id, db)


# ── PUT /settings ──────────────────────────────────────────────────────────────


@router.put("/", response_model=SettingsOut)
async def update_settings(
    payload: SettingsUpdate,
    club_id: UUID         = Depends(get_current_club_id),
    user_id: UUID         = Depends(get_current_user_id),
    _roles:  list         = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
) -> SettingsOut:
    """
    Actualiza los ajustes del club activo.
    Solo disponible para usuarios con rol OWNER.

    Secciones actualizables: profile, club, payments, notifications.
    Solo se procesan las secciones presentes en el payload (PATCH semántico).
    """
    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado.")

    # ── Perfil del admin → actualiza User.first_name / User.last_name ─────────
    if payload.profile and payload.profile.fullName is not None:
        staff_result = await db.execute(
            select(ClubStaff).where(
                ClubStaff.club_id == club_id,
                ClubStaff.user_id == user_id,
            )
        )
        staff = staff_result.scalar_one_or_none()
        if staff and staff.user_id:
            user = await db.get(User, staff.user_id)
            if user:
                parts = payload.profile.fullName.strip().split(" ", 1)
                user.first_name = parts[0]
                user.last_name  = parts[1] if len(parts) > 1 else ""

    # ── Club config ───────────────────────────────────────────────────────────
    if payload.club:
        c = payload.club
        if c.name is not None:
            club.name = c.name
        if c.phone is not None:
            club.phone = c.phone or None
        if c.address is not None:
            club.address = c.address or None
        if c.city is not None:
            club.city = c.city or None
        if c.openTime is not None:
            club.open_time = _str_to_time(c.openTime)
        if c.closeTime is not None:
            club.close_time = _str_to_time(c.closeTime)
        if c.cancellationPolicyHours is not None:
            club.cancellation_policy_hours = c.cancellationPolicyHours

    # ── Pagos ─────────────────────────────────────────────────────────────────
    if payload.payments:
        p = payload.payments
        if p.requireDeposit is not None and hasattr(club, "require_deposit"):
            club.require_deposit = p.requireDeposit
        if p.mercadopagoToken is not None and hasattr(club, "mercadopago_token"):
            club.mercadopago_token = p.mercadopagoToken or None

    # ── Notificaciones ────────────────────────────────────────────────────────
    if payload.notifications:
        n = payload.notifications
        if n.whatsappNewReservations is not None and hasattr(club, "notif_whatsapp"):
            club.notif_whatsapp = n.whatsappNewReservations
        if n.cancellationAlerts is not None and hasattr(club, "notif_cancellation"):
            club.notif_cancellation = n.cancellationAlerts
        if n.dailyCashReport is not None and hasattr(club, "notif_cash_report"):
            club.notif_cash_report = n.dailyCashReport

    try:
        await db.commit()
        await db.refresh(club)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al actualizar settings del club %s: %s", club_id, exc)
        raise HTTPException(status_code=500, detail="Error al guardar los cambios.")

    logger.info(
        "Settings del club %s actualizados. Secciones: %s",
        club_id,
        [k for k, v in payload.model_dump(exclude_none=True).items() if v],
    )

    return await _build_settings(club, club_id, user_id, db)
