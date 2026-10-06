"""
Precio de una reserva: tarifa por hora del tipo de cliente × minutos / 60, al centavo.
Es la única implementación; el panel y la app reciben el precio ya calculado.
"""

from decimal import ROUND_HALF_UP, Decimal

from app.domain.enums import CustomerType

_CENT = Decimal("0.01")


def hourly_rate(price_member: Decimal, price_guest: Decimal, customer: CustomerType) -> Decimal:
    return price_member if customer == CustomerType.MEMBER else price_guest


def reservation_price(
    price_member: Decimal, price_guest: Decimal, customer: CustomerType, minutes: int
) -> Decimal:
    if minutes <= 0:
        raise ValueError("La duración debe ser positiva.")
    raw = hourly_rate(price_member, price_guest, customer) * minutes / 60
    return raw.quantize(_CENT, rounding=ROUND_HALF_UP)
