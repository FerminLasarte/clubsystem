"""
ClubSync — Auth Router
=======================
Endpoints:
  POST /api/v1/auth/login        → Autenticación con soporte multi-club.
  POST /api/v1/auth/mobile-login → Login para app móvil (acepta usuarios sin club).
  POST /api/v1/auth/switch-club  → Cambia el club activo sin re-autenticar.
  POST /api/v1/auth/register     → Registro de usuario base (sin rol).
  POST /api/v1/auth/logout       → Placeholder (token stateless).

Flujo RBAC (sistema nuevo):
  1. Verifica credenciales contra users.password_hash.
  2. Busca ClubStaff activos para ese email.
  3. Emite JWT con: sub=user_id, club_id, roles=[...], email.
  4. Retorna available_clubs para el ClubSwitcher del frontend.

Flujo legacy (auto-migración):
  Si existe user.club_id pero no hay ClubStaff, se crea un registro OWNER
  automáticamente. Esto migra silenciosamente los usuarios pre-RBAC.

JWT:
  - `roles` es un array: ["OWNER"] o ["RESERVATIONS_MANAGER", "STOCK_MANAGER"]
  - JWT limitado (mobile sin club): roles=[], club_id ausente.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.middleware.tenant import _decode_token
from app.models.club import Club
from app.models.club_staff import ClubStaff
from app.models.user import User

router = APIRouter()
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    first_name: str
    last_name:  str
    email:      EmailStr
    password:   str
    club_id:    Optional[UUID] = None


class UserOut(BaseModel):
    """Respuesta del endpoint /register. Sin campo role (users son globales)."""
    id:            UUID
    club_id:       Optional[UUID] = None
    email:         str
    first_name:    str
    last_name:     str
    is_active:     bool
    member_number: Optional[str]
    created_at:    str

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email:    str
    password: str


class SwitchClubRequest(BaseModel):
    club_id: UUID


class ClubInfo(BaseModel):
    id:            UUID
    slug:          str
    name:          str
    primary_color: str
    accent_color:  str
    logo_url:      Optional[str]
    font_family:   str

    class Config:
        from_attributes = True


class StaffClubOut(BaseModel):
    """Club al que el operador tiene acceso, con su lista de roles."""
    club_id:       UUID
    club_name:     str
    club_slug:     str
    roles:         list[str]   # ["OWNER"] o ["RESERVATIONS_MANAGER", "STOCK_MANAGER"]
    primary_color: str
    accent_color:  str
    logo_url:      Optional[str]
    font_family:   str


class LoginResponse(BaseModel):
    access_token:    str
    token_type:      str = "bearer"
    club:            ClubInfo
    user_roles:      list[str]  # roles del usuario en el club activo
    available_clubs: list[StaffClubOut]


class MobileLoginResponse(BaseModel):
    """
    Variante de LoginResponse para la app móvil.

    Cuando club es null → JWT limitado (roles=[], sin club_id).
    Solo permite acceder a /notifications y /invitations.
    """
    access_token:            str
    token_type:              str = "bearer"
    club:                    Optional[ClubInfo] = None
    user_roles:              list[str]
    available_clubs:         list[StaffClubOut]
    has_pending_invitations: bool = False


# ── Helpers ───────────────────────────────────────────────────

def _club_to_info(club: Club) -> ClubInfo:
    return ClubInfo(
        id=club.id, slug=club.slug, name=club.name,
        primary_color=club.primary_color, accent_color=club.accent_color,
        logo_url=club.logo_url, font_family=club.font_family,
    )


def _club_to_staff_out(club: Club, roles: list[str]) -> StaffClubOut:
    return StaffClubOut(
        club_id=club.id, club_name=club.name, club_slug=club.slug,
        roles=roles, primary_color=club.primary_color,
        accent_color=club.accent_color, logo_url=club.logo_url,
        font_family=club.font_family,
    )


def _primary_roles(staff_rows: list) -> tuple:
    """Devuelve (primary_staff, primary_club) priorizando registros con OWNER."""
    return next(
        ((s, c) for s, c in staff_rows if "OWNER" in s.roles),
        staff_rows[0],
    )


# ── POST /login ───────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login para el panel de administración web.

    Solo usuarios con ClubStaff activo pueden acceder.
    Los usuarios sin ClubStaff pero con club_id legacy se auto-migran
    creando un registro ClubStaff OWNER en el momento del primer login.
    """
    # 1. Verificar credenciales
    user_result = await db.execute(
        select(User)
        .where(User.email == payload.email, User.is_active == True)
        .limit(1)
    )
    user = user_result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    # 2. Buscar ClubStaff activos
    staff_result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.email == payload.email,
            ClubStaff.is_active == True,
            Club.is_active == True,
        )
        .order_by(ClubStaff.created_at)
    )
    staff_rows = staff_result.all()

    # ── Auto-migración legacy → RBAC ──────────────────────────
    if not staff_rows:
        if user.club_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta no tiene acceso a ningún panel de administración.",
            )

        club_result = await db.execute(
            select(Club).where(Club.id == user.club_id, Club.is_active == True)
        )
        club = club_result.scalar_one_or_none()

        if not club:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El club asociado a tu cuenta no está activo",
            )

        # Primera vez: crear ClubStaff OWNER para este usuario legacy
        logger.info(
            "Auto-migrando usuario legacy %s → ClubStaff[OWNER] en '%s'",
            user.email, club.name,
        )
        new_staff = ClubStaff(
            email=user.email,
            club_id=club.id,
            user_id=user.id,
            roles=["OWNER"],
            status="ACTIVE",
            is_active=True,
        )
        db.add(new_staff)
        await db.commit()
        await db.refresh(new_staff)
        staff_rows = [(new_staff, club)]

    # ── Caso RBAC: hay registros ClubStaff ───────────────────
    available_clubs = [_club_to_staff_out(club, staff.roles) for staff, club in staff_rows]
    primary_staff, primary_club = _primary_roles(staff_rows)

    token = create_access_token(
        sub=str(user.id),
        email=user.email,
        club_id=primary_club.id,
        roles=primary_staff.roles,
    )

    return LoginResponse(
        access_token=token,
        club=_club_to_info(primary_club),
        user_roles=primary_staff.roles,
        available_clubs=available_clubs,
    )


# ── POST /switch-club ─────────────────────────────────────────

@router.post("/switch-club", response_model=LoginResponse)
async def switch_club(
    payload: SwitchClubRequest,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Cambia el club activo del operador sin re-autenticar con contraseña.
    Valida membresía ClubStaff en el club destino y emite nuevo JWT.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    token_data = _decode_token(credentials.credentials)
    email       = token_data.get("email")
    user_id_str = token_data.get("sub")

    if not email or not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: faltan campos requeridos",
        )

    row_result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.email == email,
            ClubStaff.club_id == payload.club_id,
            ClubStaff.is_active == True,
            Club.is_active == True,
        )
    )
    row = row_result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés acceso a ese club o el club no está activo",
        )

    staff, target_club = row

    new_token = create_access_token(
        sub=user_id_str,
        email=email,
        club_id=target_club.id,
        roles=staff.roles,
    )

    all_result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.email == email,
            ClubStaff.is_active == True,
            Club.is_active == True,
        )
        .order_by(ClubStaff.created_at)
    )
    available_clubs = [_club_to_staff_out(c, s.roles) for s, c in all_result.all()]

    return LoginResponse(
        access_token=new_token,
        club=_club_to_info(target_club),
        user_roles=staff.roles,
        available_clubs=available_clubs,
    )


# ── POST /mobile-login ────────────────────────────────────────

@router.post("/mobile-login", response_model=MobileLoginResponse)
async def mobile_login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login exclusivo para la app móvil.

    Usuarios sin ClubStaff activo reciben un JWT limitado (roles=[], sin club_id)
    en lugar de un HTTP 403. Con ese token pueden consultar /notifications
    y aceptar invitaciones pendientes en /invitations.
    """
    user_result = await db.execute(
        select(User)
        .where(User.email == payload.email, User.is_active == True)
        .limit(1)
    )
    user = user_result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    staff_result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.email == payload.email,
            ClubStaff.is_active == True,
            Club.is_active == True,
        )
        .order_by(ClubStaff.created_at)
    )
    staff_rows = staff_result.all()

    # ── Sin club activo: JWT limitado ──────────────────────────
    if not staff_rows:
        pending_result = await db.execute(
            select(ClubStaff).where(
                ClubStaff.email == payload.email,
                ClubStaff.status == "PENDING",
            )
        )
        has_pending = pending_result.scalar_one_or_none() is not None
        limited_token = create_access_token(sub=str(user.id), email=user.email, roles=[])

        return MobileLoginResponse(
            access_token=limited_token,
            club=None,
            user_roles=[],
            available_clubs=[],
            has_pending_invitations=has_pending,
        )

    # ── Con clubs activos: token completo ──────────────────────
    available_clubs = [_club_to_staff_out(club, staff.roles) for staff, club in staff_rows]
    primary_staff, primary_club = _primary_roles(staff_rows)

    token = create_access_token(
        sub=str(user.id),
        email=user.email,
        club_id=primary_club.id,
        roles=primary_staff.roles,
    )

    return MobileLoginResponse(
        access_token=token,
        club=_club_to_info(primary_club),
        user_roles=primary_staff.roles,
        available_clubs=available_clubs,
        has_pending_invitations=False,
    )


# ── POST /register ────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo usuario global (sin rol).

    Los roles se asignan posteriormente vía invitación ClubStaff.
    El usuario registrado podrá iniciar sesión en la app móvil pero
    no en el panel de administración hasta aceptar una invitación de club.
    """
    if payload.club_id is not None:
        club_result = await db.execute(
            select(Club).where(Club.id == payload.club_id, Club.is_active == True)
        )
        if club_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Club no encontrado o inactivo",
            )

    # El email es único globalmente — los usuarios son entidades globales (B2B2C).
    # No se permite el mismo email aunque sea en distintos clubs.
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )

    user = User(
        club_id=payload.club_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserOut(
        id=user.id,
        club_id=user.club_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        member_number=user.member_number,
        created_at=user.created_at.isoformat(),
    )


# ── POST /logout ──────────────────────────────────────────────

@router.post("/logout")
async def logout():
    """El cliente elimina el token de localStorage — no hay estado server-side."""
    return {"message": "ok"}
