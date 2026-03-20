# backend/app/routers/members.py
"""
ClubSync — Members Router
==========================
CRUD completo de socios del club activo.

Endpoints:
  GET    /api/v1/members         → lista paginada + búsqueda
  POST   /api/v1/members         → crear socio (requiere OWNER)
  PUT    /api/v1/members/{id}    → editar socio (requiere OWNER)
  DELETE /api/v1/members/{id}    → soft-delete (requiere OWNER)
  GET    /api/v1/members/export/csv → exportar CSV

Permisos:
  - GET       → cualquier rol autenticado con club_id válido
  - POST / PUT / DELETE → solo OWNER
"""
import csv
import io
import secrets
import string
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.middleware.tenant import get_current_club_id, require_role
from app.models.user import User

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────────────

class MemberOut(BaseModel):
    id:              UUID
    email:           str
    first_name:      str
    last_name:       str
    phone:           Optional[str]
    dni:             Optional[str]
    member_number:   Optional[str]
    birth_date:      Optional[date]
    joined_at:       Optional[date]
    gender:          Optional[str]
    membership_plan: Optional[str]
    is_active:       bool
    last_login_at:   Optional[datetime] = None
    created_at:      datetime

    class Config:
        from_attributes = True


class MembersResponse(BaseModel):
    items:     list[MemberOut]
    total:     int
    page:      int
    page_size: int


class MemberCreate(BaseModel):
    first_name:      str           = Field(..., min_length=1, max_length=100)
    last_name:       str           = Field(..., min_length=1, max_length=100)
    email:           EmailStr
    phone:           Optional[str] = Field(None, max_length=50)
    dni:             Optional[str] = Field(None, max_length=20)
    member_number:   Optional[str] = Field(None, max_length=50)
    birth_date:      Optional[date] = None
    joined_at:       Optional[date] = None
    gender:          Optional[str] = Field(None, max_length=20)
    membership_plan: Optional[str] = Field(None, max_length=100)


class MemberUpdate(BaseModel):
    first_name:      Optional[str]  = Field(None, min_length=1, max_length=100)
    last_name:       Optional[str]  = Field(None, min_length=1, max_length=100)
    phone:           Optional[str]  = Field(None, max_length=50)
    dni:             Optional[str]  = Field(None, max_length=20)
    member_number:   Optional[str]  = Field(None, max_length=50)
    birth_date:      Optional[date] = None
    joined_at:       Optional[date] = None
    gender:          Optional[str]  = Field(None, max_length=20)
    membership_plan: Optional[str]  = Field(None, max_length=100)
    is_active:       Optional[bool] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _random_password(length: int = 20) -> str:
    """Genera una contraseña aleatoria segura para socios creados por admin."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_members_csv(
    is_active: Optional[bool] = Query(None),
    club_id:   UUID           = Depends(get_current_club_id),
    db:        AsyncSession   = Depends(get_db),
):
    """Exporta todos los socios del club como CSV (UTF-8 BOM)."""
    q = select(User).where(User.club_id == club_id)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    q = q.order_by(User.last_name, User.first_name)
    result = await db.execute(q)
    members = result.scalars().all()

    output = io.StringIO()
    # BOM para Excel
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "N° Socio", "Apellido", "Nombre", "Email",
        "DNI", "Teléfono", "Género", "Plan",
        "Ingresó", "Fecha nac.", "Estado",
    ])
    for m in members:
        writer.writerow([
            m.member_number or "",
            m.last_name,
            m.first_name,
            m.email,
            m.dni or "",
            m.phone or "",
            m.gender or "",
            m.membership_plan or "",
            m.joined_at.isoformat() if m.joined_at else "",
            m.birth_date.isoformat() if m.birth_date else "",
            "Activo" if m.is_active else "Inactivo",
        ])

    today = date.today().isoformat()
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="socios_{today}.csv"'},
    )


@router.get("/", response_model=MembersResponse)
async def list_members(
    search:    Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    page:      int            = Query(1, ge=1),
    page_size: int            = Query(50, ge=1, le=200),
    club_id:   UUID           = Depends(get_current_club_id),
    db:        AsyncSession   = Depends(get_db),
):
    q = select(User).where(User.club_id == club_id)

    if search:
        term = f"%{search.lower()}%"
        q = q.where(
            or_(
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
                func.lower(User.email).like(term),
                func.lower(User.member_number).like(term),
                func.lower(User.dni).like(term),
            )
        )

    if is_active is not None:
        q = q.where(User.is_active == is_active)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(User.last_name, User.first_name)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return MembersResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def create_member(
    payload:  MemberCreate,
    club_id:  UUID         = Depends(get_current_club_id),
    _:        dict         = Depends(require_role("OWNER")),
    db:       AsyncSession = Depends(get_db),
):
    # Verificar email único
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email.",
        )

    member = User(
        club_id=club_id,
        email=payload.email,
        password_hash=hash_password(_random_password()),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        dni=payload.dni,
        member_number=payload.member_number,
        birth_date=payload.birth_date,
        joined_at=payload.joined_at or date.today(),
        gender=payload.gender,
        membership_plan=payload.membership_plan,
        is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.put("/{member_id}", response_model=MemberOut)
async def update_member(
    member_id: UUID,
    payload:   MemberUpdate,
    club_id:   UUID         = Depends(get_current_club_id),
    _:         dict         = Depends(require_role("OWNER")),
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == member_id, User.club_id == club_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    member_id: UUID,
    club_id:   UUID         = Depends(get_current_club_id),
    _:         dict         = Depends(require_role("OWNER")),
    db:        AsyncSession = Depends(get_db),
):
    """Soft-delete: setea is_active=False."""
    result = await db.execute(
        select(User).where(User.id == member_id, User.club_id == club_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado.")

    member.is_active = False
    await db.commit()
