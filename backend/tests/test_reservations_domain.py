"""Reglas puras de precios y turnos (sin base de datos)."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from app.domain.enums import CustomerType
from app.domain.pricing import reservation_price
from app.domain.slots import (
    AppDuration,
    available_starts,
    on_grid,
    operating_window,
    window_for_start,
    within_window,
)

BA = ZoneInfo("America/Argentina/Buenos_Aires")  # UTC-3, sin horario de verano
TOKYO = ZoneInfo("Asia/Tokyo")  # UTC+9
DAY = date(2030, 3, 15)
PAST = datetime(2000, 1, 1, tzinfo=UTC)


def test_price_is_hourly_rate_of_the_customer_type_times_minutes() -> None:
    member, guest = Decimal("8000"), Decimal("12000")
    assert reservation_price(member, guest, CustomerType.MEMBER, 60) == Decimal("8000.00")
    assert reservation_price(member, guest, CustomerType.MEMBER, 90) == Decimal("12000.00")
    assert reservation_price(member, guest, CustomerType.GUEST, 120) == Decimal("24000.00")
    # 1000/h × 50 min = 833.333… → 833.33; 1001/h × 30 min = 500.5 → 500.50
    assert reservation_price(Decimal("1000"), guest, CustomerType.MEMBER, 50) == Decimal("833.33")
    assert reservation_price(Decimal("1001"), guest, CustomerType.MEMBER, 30) == Decimal("500.50")
    # Medio centavo redondea hacia arriba: 0.01/h × 30 min = 0.005 → 0.01
    assert reservation_price(Decimal("0.01"), guest, CustomerType.MEMBER, 30) == Decimal("0.01")


def test_price_rejects_non_positive_duration() -> None:
    with pytest.raises(ValueError):
        reservation_price(Decimal("1"), Decimal("1"), CustomerType.MEMBER, 0)


def test_operating_window_uses_the_club_timezone_and_null_means_full_day() -> None:
    assert operating_window(DAY, BA, time(8), time(23)) == (
        datetime(2030, 3, 15, 11, tzinfo=UTC),
        datetime(2030, 3, 16, 2, tzinfo=UTC),
    )
    assert operating_window(DAY, TOKYO, None, None) == (
        datetime(2030, 3, 14, 15, tzinfo=UTC),
        datetime(2030, 3, 15, 15, tzinfo=UTC),
    )
    # Solo apertura: hasta la medianoche local.
    assert operating_window(DAY, BA, time(10), None)[1] == datetime(2030, 3, 16, 3, tzinfo=UTC)


def test_within_window_does_not_cross_closing_or_midnight() -> None:
    def local(h: int, m: int = 0, day: date = DAY) -> datetime:
        return datetime.combine(day, time(h, m), tzinfo=BA)

    window = window_for_start(local(22), BA, time(8), time(23))
    assert within_window(local(22), local(23), window)
    assert not within_window(local(22), local(23, 30), window)
    assert not within_window(
        local(7, 30), local(8, 30), window_for_start(local(7, 30), BA, time(8), time(23))
    )
    full = window_for_start(local(23), BA, None, None)
    assert within_window(local(23), local(0, day=DAY + timedelta(days=1)), full)
    assert not within_window(local(23, 30), local(0, 30, day=DAY + timedelta(days=1)), full)


def test_grid_is_counted_from_opening() -> None:
    window = operating_window(DAY, BA, time(8, 15), time(22))
    assert on_grid(window[0] + timedelta(minutes=90), window)
    assert not on_grid(window[0] + timedelta(minutes=45), window)


def test_available_starts_skip_busy_intervals_and_closing() -> None:
    window = operating_window(DAY, BA, time(8), time(12))
    busy = [(datetime.combine(DAY, time(9), tzinfo=BA), datetime.combine(DAY, time(10), tzinfo=BA))]
    starts = available_starts(window, timedelta(minutes=60), busy, PAST)
    assert [s.astimezone(BA).strftime("%H:%M") for s in starts] == [
        "08:00",
        "10:00",
        "10:30",
        "11:00",
    ]
    # 120 min: ningún turno que pise 09:00–10:00 ni pase de las 12:00.
    starts = available_starts(window, timedelta(minutes=120), busy, PAST)
    assert [s.astimezone(BA).strftime("%H:%M") for s in starts] == ["10:00"]


def test_available_starts_exclude_the_past() -> None:
    window = operating_window(DAY, BA, time(8), time(11))
    now = datetime.combine(DAY, time(9), tzinfo=BA)
    starts = available_starts(window, timedelta(minutes=60), [], now)
    # Un turno que empieza justo ahora ya no se ofrece.
    assert [s.astimezone(BA).strftime("%H:%M") for s in starts] == ["09:30", "10:00"]


def test_available_starts_near_midnight_in_a_non_utc_zone() -> None:
    window = operating_window(DAY, TOKYO, None, None)
    late = datetime.combine(DAY, time(23), tzinfo=TOKYO)
    starts = available_starts(
        window, timedelta(minutes=60), [(late, late + timedelta(hours=1))], PAST
    )
    local = [s.astimezone(TOKYO) for s in starts]
    assert local[0] == datetime.combine(DAY, time(0), tzinfo=TOKYO)
    assert local[-1] == datetime.combine(DAY, time(22), tzinfo=TOKYO)
    assert all(s.date() == DAY for s in local)


def test_app_durations() -> None:
    assert [d.value for d in AppDuration] == [60, 90, 120]
