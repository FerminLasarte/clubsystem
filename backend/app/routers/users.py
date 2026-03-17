# backend/app/routers/users.py
from uuid import UUID
from typing import Optional
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, cast, String, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id
from app.models.user import User

router = APIRouter()


class MemberOut(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    dni: Optional[str]
    member_number: Optional[str]
    joined_at: Optional[date]
    is_active: bool
    role: str
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MembersResponse(BaseModel):
    items: list[MemberOut]
    total: int
    page: int
    page_size: int


class UsersStats(BaseModel):
    total: int
    active: int
    inactive: int


@router.get("/", response_model=MembersResponse)
async def list_members(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    role_col = cast(User.role, String)
    q = select(User).where(User.club_id == club_id)

    if search:
        term = f"%{search.lower()}%"
        q = q.where(
            or_(
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
                func.lower(User.email).like(term),
                func.lower(User.member_number).like(term),
            )
        )
    if role:
        q = q.where(role_col == role)
    else:
        # Por defecto solo socios, no admins
        q = q.where(role_col == "member")

    if is_active is not None:
        q = q.where(User.is_active == is_active)

    # Total
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginación
    q = q.order_by(User.last_name, User.first_name)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return MembersResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=UsersStats)
async def get_users_stats(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    role_col = cast(User.role, String)
    
    # Query count by is_active status
    q = select(User.is_active, func.count(User.id)).where(
        User.club_id == club_id,
        role_col == "member"
    ).group_by(User.is_active)
    
    result = await db.execute(q)
    rows = result.all()
    
    active = 0
    inactive = 0
    for is_active_status, count in rows:
        if is_active_status:
            active = count
        else:
            inactive = count
            
    return UsersStats(
        total=active + inactive,
        active=active,
        inactive=inactive,
    )


@router.get("/{user_id}", response_model=MemberOut)
async def get_member(
    user_id: UUID,
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.club_id == club_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
    return user