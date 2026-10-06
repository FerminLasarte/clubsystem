"""
Fechas y horas en la zona horaria del club. Regla: en la base todo es timestamptz (UTC);
"hoy", "este mes" y los límites de un día se calculan en la zona del club y se filtran
como rangos semiabiertos [inicio, fin).
"""

from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

Period = Literal["day", "week", "month", "year"]


def utcnow() -> datetime:
    return datetime.now(UTC)


def tz(name: str) -> ZoneInfo:
    return ZoneInfo(name)


def today_in(zone: ZoneInfo) -> date:
    return datetime.now(zone).date()


def day_bounds(day: date, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """Inicio y fin (exclusivo) del día local, en UTC."""
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def days_bounds(first: date, last: date, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """Inicio del primer día y fin (exclusivo) del último, ambos locales, en UTC."""
    return day_bounds(first, zone)[0], day_bounds(last, zone)[1]


def period_start(period: Period, today: date) -> date:
    if period == "day":
        return today
    if period == "week":
        return today - timedelta(days=today.weekday())
    if period == "month":
        return today.replace(day=1)
    return today.replace(month=1, day=1)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """Primer día del mes y primer día del mes siguiente."""
    start = date(year, month, 1)
    end = date(year + (month == 12), month % 12 + 1, 1)
    return start, end
