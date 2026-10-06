"""
Cancelación de reservas por el socio desde la app.

Las pendientes se cancelan siempre; las confirmadas, hasta `notice_hours` antes del inicio.
`notice_hours` se configura por club. Es la única implementación: el endpoint la aplica y la
app recibe el resultado (`can_cancel`, `cancel_deadline`) ya calculado.
"""

from datetime import datetime, timedelta

from app.domain.enums import ReservationStatus

DEFAULT_MEMBER_CANCEL_NOTICE_HOURS = 24
# Dos semanas, el horizonte de reservas de la app: un valor mayor equivaldría a no
# permitir nunca cancelar una confirmada.
MAX_MEMBER_CANCEL_NOTICE_HOURS = 14 * 24


def member_cancel_deadline(
    status: ReservationStatus, starts_at: datetime, notice_hours: int
) -> datetime | None:
    """Hasta cuándo puede cancelar el socio una confirmada. None si no aplica un plazo."""
    if status != ReservationStatus.CONFIRMED:
        return None
    return starts_at - timedelta(hours=notice_hours)


def member_can_cancel(
    status: ReservationStatus, starts_at: datetime, notice_hours: int, now: datetime
) -> bool:
    if status == ReservationStatus.PENDING:
        return True
    deadline = member_cancel_deadline(status, starts_at, notice_hours)
    return deadline is not None and now <= deadline
