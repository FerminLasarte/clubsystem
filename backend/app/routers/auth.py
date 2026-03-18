"""
ClubSync — Auth Router
=======================
Endpoints:
  POST /api/v1/auth/login        → Autenticación con soporte multi-club.
  POST /api/v1/auth/switch-club  → Cambia el club activo sin re-autenticar.
  POST /api/v1/auth/logout       → Placeholder (token-based, no server-side state).

Flujo de login multi-club:
  1. Verifica credenciales contra users.password_hash (cualquier club).
  2. Busca todos los registros ClubStaff con ese email.
  3. Si hay registros ClubStaff → usa el sistema RBAC nuevo.
  4. Si no hay registros (legacy) → mapea user.role a StaffRole y usa user.club_id.
  5. Emite JWT con: sub=user_id, club_id, role (StaffRole), email.
  6. Retorna available_clubs para que el frontend muestre el ClubSwitcher.

El campo 'email' en el JWT permite que switch-club identifique al operador
cross-club sin necesidad de re-autenticar con contraseña.
"""

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

# Mapeo de roles legacy (User.role) → StaffRole
_LEGACY_ROLE_MAP: dict[str, str] = {
    "admin": "OWNER",
    "staff": "RESERVATIONS_MANAGER",
    "member": "RESERVATIONS_MANAGER",
}


# ── Schemas ───────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    club_id: Optional[UUID] = None


class UserOut(BaseModel):
    id: UUID
    club_id: Optional[UUID] = None
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    member_number: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class SwitchClubRequest(BaseModel):
    club_id: UUID


class ClubInfo(BaseModel):
    id: UUID
    slug: str
    name: str
    primary_color: str
    accent_color: str
    logo_url: Optional[str]
    font_family: str

    class Config:
        from_attributes = True


class StaffClubOut(BaseModel):
    """Representa un club al que el operador tiene acceso, con su rol."""
    club_id: UUID
    club_name: str
    club_slug: str
    role: str            # OWNER | RESERVATIONS_MANAGER | STOCK_MANAGER
    primary_color: str
    accent_color: str
    logo_url: Optional[str]
    font_family: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    club: ClubInfo
    user_role: str
    available_clubs: list[StaffClubOut]


# ── Helpers ───────────────────────────────────────────────────
def _club_to_info(club: Club) -> ClubInfo:
    return ClubInfo(
        id=club.id,
        slug=club.slug,
        name=club.name,
        primary_color=club.primary_color,
        accent_color=club.accent_color,
        logo_url=club.logo_url,
        font_family=club.font_family,
    )


def _club_to_staff_out(club: Club, role: str) -> StaffClubOut:
    return StaffClubOut(
        club_id=club.id,
        club_name=club.name,
        club_slug=club.slug,
        role=role,
        primary_color=club.primary_color,
        accent_color=club.accent_color,
        logo_url=club.logo_url,
        font_family=club.font_family,
    )


# ── POST /login ───────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login con soporte multi-club RBAC.

    Verifica credenciales contra cualquier User activo con ese email,
    luego resuelve los clubs disponibles via ClubStaff (RBAC)
    o via User.club_id + User.role (legacy).
    """
    # 1. Verificar credenciales — buscar en cualquier club
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

    # 2. Buscar membresías ClubStaff activas para este email
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

    # ── Caso legacy: no hay registros ClubStaff ───────────────
    if not staff_rows:
        # Usuarios sin club (registrados vía app móvil) — aún no pueden iniciar sesión
        if user.club_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta aún no está asociada a ningún club. Un administrador debe asignarte primero.",
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

        role = _LEGACY_ROLE_MAP.get(user.role, "OWNER")
        token = create_access_token(sub=str(user.id), club_id=club.id, role=role, email=user.email)

        return LoginResponse(
            access_token=token,
            club=_club_to_info(club),
            user_role=role,
            available_clubs=[_club_to_staff_out(club, role)],
        )

    # ── Caso RBAC: hay registros ClubStaff ───────────────────
    available_clubs = [
        _club_to_staff_out(club, staff.role)
        for staff, club in staff_rows
    ]

    # Seleccionar club principal: primer OWNER, o el primero de la lista
    primary_staff, primary_club = next(
        ((s, c) for s, c in staff_rows if s.role == "OWNER"),
        staff_rows[0],
    )

    token = create_access_token(sub=str(user.id), club_id=primary_club.id, role=primary_staff.role, email=user.email)

    return LoginResponse(
        access_token=token,
        club=_club_to_info(primary_club),
        user_role=primary_staff.role,
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
    Valida que el operador tenga un ClubStaff activo en el club destino
    y emite un nuevo JWT con el nuevo club_id + role.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    token_data = _decode_token(credentials.credentials)
    email = token_data.get("email")
    user_id_str = token_data.get("sub")

    if not email or not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: faltan campos requeridos",
        )

    # Verificar membresía en club destino
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

    # Nuevo token: mismo user_id (sub), nuevo club_id + role
    new_token = create_access_token(
        sub=user_id_str,
        club_id=target_club.id,
        role=staff.role,
        email=email,
    )

    # Refrescar lista completa de clubs del operador
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
    available_clubs = [
        _club_to_staff_out(c, s.role) for s, c in all_result.all()
    ]

    return LoginResponse(
        access_token=new_token,
        club=_club_to_info(target_club),
        user_role=staff.role,
        available_clubs=available_clubs,
    )


# ── POST /register ────────────────────────────────────────────
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo usuario (member) en un club.

    - Verifica que el club exista y esté activo.
    - Devuelve HTTP 400 si el email ya está registrado en ese club.
    - Hashea la contraseña con bcrypt (via passlib).
    - El rol por defecto es 'member'.
    """
    # Verificar club si se proporcionó
    if payload.club_id is not None:
        club_result = await db.execute(
            select(Club).where(Club.id == payload.club_id, Club.is_active == True)
        )
        if club_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Club no encontrado o inactivo",
            )

    # Verificar unicidad de email en el mismo club (o sin club)
    email_filter = [User.email == payload.email, User.club_id == payload.club_id]
    existing = await db.execute(select(User).where(*email_filter))
    if existing.scalar_one_or_none() is not None:
        scope = "en este club" if payload.club_id else "sin club asignado"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El email ya está registrado {scope}",
        )

    user = User(
        club_id=payload.club_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role="member",
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
        role=user.role,
        is_active=user.is_active,
        member_number=user.member_number,
        created_at=user.created_at.isoformat(),
    )


# ── POST /logout ──────────────────────────────────────────────
@router.post("/logout")
async def logout():
    """El cliente elimina el token de localStorage — no hay estado server-side."""
    return {"message": "ok"}
