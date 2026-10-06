"""
Turnos: horario operativo del club y generación de inicios disponibles.

Todo en datetimes aware. El horario del club (open_time/close_time) es hora local de SU zona;
NULL en un extremo significa sin restricción (00:00 o 24:00). Una reserva entra en el horario
de un solo día local: no cruza la medianoche.
"""

from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from enum import IntEnum
from zoneinfo import ZoneInfo

SLOT_STEP = timedelta(minutes=30)


class AppDuration(IntEnum):
    """Duraciones (minutos) que ofrece la app: las mismas que ofrecían web y mobile."""

    MIN_60 = 60
    MIN_90 = 90
    MIN_120 = 120


Interval = tuple[datetime, datetime]


def operating_window(
    day: date, zone: ZoneInfo, open_time: time | None, close_time: time | None
) -> Interval:
    """Inicio y fin (exclusivo) del horario operativo de un día local, en UTC."""
    start = datetime.combine(day, open_time or time.min, tzinfo=zone)
    if close_time is None:
        end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    else:
        end = datetime.combine(day, close_time, tzinfo=zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def window_for_start(
    starts_at: datetime, zone: ZoneInfo, open_time: time | None, close_time: time | None
) -> Interval:
    """Horario operativo del día local en el que empieza `starts_at`."""
    return operating_window(starts_at.astimezone(zone).date(), zone, open_time, close_time)


def within_window(starts_at: datetime, ends_at: datetime, window: Interval) -> bool:
    return window[0] <= starts_at < ends_at <= window[1]


def on_grid(starts_at: datetime, window: Interval) -> bool:
    """El inicio cae en la grilla de 30 minutos contada desde la apertura."""
    return (starts_at - window[0]) % SLOT_STEP == timedelta(0)


def available_starts(
    window: Interval, duration: timedelta, busy: Iterable[Interval], now: datetime
) -> list[datetime]:
    """
    Inicios cada 30 min desde la apertura tales que [inicio, inicio + duración) entra en el
    horario, no se superpone con `busy` (reservas activas) y empieza después de `now`.
    """
    taken = sorted(busy)
    starts: list[datetime] = []
    current = window[0]
    while current + duration <= window[1]:
        end = current + duration
        if current > now and not any(b_start < end and b_end > current for b_start, b_end in taken):
            starts.append(current)
        current += SLOT_STEP
    return starts
