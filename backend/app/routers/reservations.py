from uuid import UUID
from typing import Optional
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id
from app.models.reservation import Reservation
from app.models.court import Court
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────

class ReservationOut(BaseModel):
    id: UUID
    court_id: UUID
    court_name: str
    user_id: UUID
    user_name: str
    status: str
    starts_at: datetime
    ends_at: datetime
    total_price: float
    paid_amount: float
    notes: Optional[str]

    class Config:
        from_attributes = True


class ReservationCreate(BaseModel):
    court_id: UUID
    user_id: UUID
    starts_at: datetime
    ends_at: datetime
    total_price: float = 0
    notes: Optional[str] = None


class ReservationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/", response_model=list[ReservationOut])
async def list_reservations(
    target_date: Optional[date] = Query(None, description="Fecha en formato YYYY-MM-DD. Default: hoy."),
    court_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    day = target_date or date.today()
    day_start = datetime.combine(day, time.min)
    day_end = datetime.combine(day, time.max)

    q = (
        select(Reservation, Court, User)
        .join(Court, Court.id == Reservation.court_id)
        .join(User, User.id == Reservation.user_id)
        .where(
            and_(
                Reservation.club_id == club_id,
                Reservation.starts_at >= day_start,
                Reservation.starts_at <= day_end,
            )
        )
    )

    if court_id:
        q = q.where(Reservation.court_id == court_id)
    if status:
        q = q.where(Reservation.status == status)

    q = q.order_by(Reservation.starts_at)
    result = await db.execute(q)
    rows = result.all()

    return [
        ReservationOut(
            id=r.id,
            court_id=r.court_id,
            court_name=c.name,
            user_id=r.user_id,
            user_name=f"{u.first_name} {u.last_name}",
            status=r.status,
            starts_at=r.starts_at,
            ends_at=r.ends_at,
            total_price=float(r.total_price),
            paid_amount=float(r.paid_amount),
            notes=r.notes,
        )
        for r, c, u in rows
    ]


@router.post("/", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreate,
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    new_res = Reservation(
        club_id=club_id,
        court_id=payload.court_id,
        user_id=payload.user_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        total_price=payload.total_price,
        notes=payload.notes,
        status="pending",
    )
    db.add(new_res)

    try:
        await db.commit()
        await db.refresh(new_res)
    except IntegrityError as e:
        await db.rollback()
        err = str(e.orig)
        if "no_overlap" in err or "conflicts with existing key" in err:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una reserva en ese horario para esta cancha.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error al crear la reserva.")

    # Fetch court and user to build response
    court = await db.get(Court, new_res.court_id)
    user = await db.get(User, new_res.user_id)

    return ReservationOut(
        id=new_res.id,
        court_id=new_res.court_id,
        court_name=court.name if court else "",
        user_id=new_res.user_id,
        user_name=f"{user.first_name} {user.last_name}" if user else "",
        status=new_res.status,
        starts_at=new_res.starts_at,
        ends_at=new_res.ends_at,
        total_price=float(new_res.total_price),
        paid_amount=float(new_res.paid_amount),
        notes=new_res.notes,
    )


@router.patch("/{reservation_id}", response_model=ReservationOut)
async def update_reservation(
    reservation_id: UUID,
    payload: ReservationUpdate,
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.get(Reservation, reservation_id)
    if not res or res.club_id != club_id:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")

    if payload.status is not None:
        res.status = payload.status
        if payload.status == "cancelled":
            res.cancelled_at = datetime.utcnow()
    if payload.notes is not None:
        res.notes = payload.notes

    await db.commit()
    await db.refresh(res)

    court = await db.get(Court, res.court_id)
    user = await db.get(User, res.user_id)

    return ReservationOut(
        id=res.id,
        court_id=res.court_id,
        court_name=court.name if court else "",
        user_id=res.user_id,
        user_name=f"{user.first_name} {user.last_name}" if user else "",
        status=res.status,
        starts_at=res.starts_at,
        ends_at=res.ends_at,
        total_price=float(res.total_price),
        paid_amount=float(res.paid_amount),
        notes=res.notes,
    )
