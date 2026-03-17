# backend/app/routers/auth.py
from datetime import datetime, timedelta
from uuid import UUID

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.club import Club

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class ClubInfo(BaseModel):
    id: UUID
    slug: str
    name: str
    primary_color: str
    accent_color: str
    logo_url: str | None
    font_family: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    club: ClubInfo
    user_role: str


# ── Helpers ───────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt(12)).decode()


def create_token(user_id: UUID, club_id: UUID, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "club_id": str(club_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Endpoints ─────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login genérico — el club se resuelve automáticamente por el email del admin.
    """
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
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

    token = create_token(user.id, user.club_id, user.role)

    return LoginResponse(
        access_token=token,
        club=club,
        user_role=user.role,
    )


@router.post("/logout")
async def logout():
    return {"message": "ok"}