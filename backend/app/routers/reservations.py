from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime, timedelta, time
from typing import List, Optional
from pydantic import BaseModel, UUID4

from app.core.database import get_db
# Nota: Deberás importar tus modelos SQLAlchemy reales aquí. 
# Usamos nombres genéricos como Court y Reservation para el ejemplo.
# from app.models import Court, Reservation

router = APIRouter()

# ── Pydantic Schemas (Idealmente mover a app/schemas/reservation.py) ──

class TimeSlot(BaseModel):
    court_id: int
    court_name: str
    start_time: datetime
    end_time: datetime

class ReservationCreate(BaseModel):
    court_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    sport_type: str

class ReservationResponse(ReservationCreate):
    id: int
    status: str
    club_id: int

    class Config:
        from_attributes = True


# ── Lógica de Generación de Turnos ──

def generate_slots(
    opening_time: time, 
    closing_time: time, 
    target_date: date, 
    duration_minutes: int
) -> List[tuple[datetime, datetime]]:
    """Genera bloques de tiempo consecutivos para un día específico."""
    slots = []
    current = datetime.combine(target_date, opening_time)
    end_of_day = datetime.combine(target_date, closing_time)
    
    while current + timedelta(minutes=duration_minutes) <= end_of_day:
        slot_end = current + timedelta(minutes=duration_minutes)
        slots.append((current, slot_end))
        current = slot_end
    return slots


# ── Endpoints ──

@router.get("/availability", response_model=List[TimeSlot])
async def get_availability(
    request: Request,
    target_date: date,
    sport_type: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Devuelve los horarios disponibles para un deporte en una fecha específica.
    """
    club_id = request.state.tenant_id  # Inyectado por tu TenantMiddleware
    
    # 1. Definir duración del turno según el deporte
    duration_minutes = 90 if sport_type.lower() == "futbol" else 60
    
    # (Mock) Horarios de apertura del club - Idealmente vienen de la DB
    opening_time = time(8, 0)
    closing_time = time(23, 0)

    # 2. Buscar canchas del club para ese deporte
    # courts_query = await db.execute(
    #     select(Court).where(and_(Court.club_id == club_id, Court.sport_type == sport_type))
    # )
    # courts = courts_query.scalars().all()
    courts = [] # Reemplazar con la query real cuando tengas el modelo Court
    
    if not courts:
        return []

    # 3. Buscar reservas existentes para ese día y esas canchas
    court_ids = [c.id for c in courts]
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = datetime.combine(target_date, time.max)
    
    # reservations_query = await db.execute(
    #     select(Reservation).where(
    #         and_(
    #             Reservation.court_id.in_(court_ids),
    #             Reservation.start_time >= start_of_day,
    #             Reservation.start_time <= end_of_day,
    #             Reservation.status != 'cancelled'
    #         )
    #     )
    # )
    # active_reservations = reservations_query.scalars().all()
    active_reservations = [] # Reemplazar con la query real

    # 4. Calcular disponibilidad real cruzando slots generados con reservas activas
    all_possible_slots = generate_slots(opening_time, closing_time, target_date, duration_minutes)
    available_slots = []
    
    for court in courts:
        court_reservations = [r for r in active_reservations if r.court_id == court.id]
        
        for slot_start, slot_end in all_possible_slots:
            # Comprobar si el slot se superpone con alguna reserva
            is_taken = any(
                r.start_time < slot_end and r.end_time > slot_start 
                for r in court_reservations
            )
            
            if not is_taken:
                available_slots.append(
                    TimeSlot(
                        court_id=court.id,
                        court_name=court.name,
                        start_time=slot_start,
                        end_time=slot_end
                    )
                )

    return available_slots


@router.post("/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    request: Request,
    res_in: ReservationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva reserva. Depende del constraint GiST en PostgreSQL para evitar double-booking.
    """
    club_id = request.state.tenant_id
    
    # new_reservation = Reservation(
    #     club_id=club_id,
    #     court_id=res_in.court_id,
    #     user_id=res_in.user_id,
    #     start_time=res_in.start_time,
    #     end_time=res_in.end_time,
    #     sport_type=res_in.sport_type,
    #     status="pending"
    # )
    # db.add(new_reservation)

    try:
        # await db.commit()
        # await db.refresh(new_reservation)
        # return new_reservation
        pass # Reemplazar con el código de arriba cuando tengas los modelos SQLAlchemy
        
    except IntegrityError as e:
        await db.rollback()
        # Capturamos el error específico del constraint de exclusión (GiST)
        error_msg = str(e.orig)
        if "conflicts with existing key" in error_msg or "overlapping_reservations" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="¡Uy! Parece que alguien más acaba de reservar esta cancha en ese horario. Por favor, elegí otro turno."
            )
        # Si es otro error de integridad (ej. court_id no existe), lanzamos un 400 genérico
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al procesar la reserva. Verifica los datos ingresados."
        )