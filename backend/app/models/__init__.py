"""Importa todos los modelos para que queden registrados en `Base.metadata`."""

from app.models.base import Base
from app.models.club import Club, ClubMembership, ClubStaff, MembershipPlan
from app.models.courts import ACTIVE_RESERVATION_STATUSES, Court, Reservation
from app.models.finance import Expense, MembershipFee, Payment
from app.models.identity import AuthSession, OneTimeToken, User
from app.models.news import ClubNews
from app.models.stock import StockItem, StockMovement

# Tablas con club_id: tienen RLS por tenant (ver migración inicial).
TENANT_TABLES = (
    "club_staff",
    "membership_plans",
    "club_memberships",
    "courts",
    "reservations",
    "payments",
    "membership_fees",
    "expenses",
    "stock_items",
    "stock_movements",
    "club_news",
)

__all__ = [
    "ACTIVE_RESERVATION_STATUSES",
    "TENANT_TABLES",
    "AuthSession",
    "Base",
    "Club",
    "ClubMembership",
    "ClubNews",
    "ClubStaff",
    "Court",
    "Expense",
    "MembershipFee",
    "MembershipPlan",
    "OneTimeToken",
    "Payment",
    "Reservation",
    "StockItem",
    "StockMovement",
    "User",
]
