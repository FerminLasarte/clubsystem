"""Enumeraciones del dominio. Se guardan como VARCHAR + CHECK (no ENUM nativo de Postgres)."""

from enum import StrEnum


class StaffRole(StrEnum):
    OWNER = "OWNER"
    RESERVATIONS_MANAGER = "RESERVATIONS_MANAGER"
    STOCK_MANAGER = "STOCK_MANAGER"


class StaffStatus(StrEnum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class MembershipStatus(StrEnum):
    # INVITED: el club invitó a la persona y falta que acepte desde la app.
    INVITED = "INVITED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    INACTIVE = "INACTIVE"


class Sport(StrEnum):
    TENNIS = "tennis"
    PADEL = "padel"
    FOOTBALL = "football"
    BASKETBALL = "basketball"
    HOCKEY = "hockey"
    VOLLEYBALL = "volleyball"
    RUGBY = "rugby"
    OTHER = "other"


class CourtSurface(StrEnum):
    CLAY = "clay"
    HARD = "hard"
    GRASS = "grass"
    SYNTHETIC = "synthetic"
    WOOD = "wood"
    CONCRETE = "concrete"
    OTHER = "other"


class ReservationStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ReservationSource(StrEnum):
    APP = "APP"
    PANEL = "PANEL"


class CustomerType(StrEnum):
    MEMBER = "MEMBER"
    GUEST = "GUEST"


class CancelReason(StrEnum):
    BY_STAFF = "BY_STAFF"
    BY_MEMBER = "BY_MEMBER"
    EXPIRED_UNCONFIRMED = "EXPIRED_UNCONFIRMED"


class TransactionType(StrEnum):
    INCOME = "INCOME"
    OUTFLOW = "OUTFLOW"


class PaymentMethod(StrEnum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    MERCADOPAGO = "MERCADOPAGO"


class FeeStatus(StrEnum):
    PENDING = "PENDING"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class ExpenseCategory(StrEnum):
    MAINTENANCE = "maintenance"
    UTILITIES = "utilities"
    SALARIES = "salaries"
    EQUIPMENT = "equipment"
    MARKETING = "marketing"
    SUPPLIES = "supplies"
    OTHER = "other"


class AnomalySeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class StockUnit(StrEnum):
    UNIT = "unit"
    BOX = "box"
    KG = "kg"
    LITER = "liter"
    PACK = "pack"


class StockMovementType(StrEnum):
    IN = "IN"
    OUT = "OUT"
    ADJUSTMENT = "ADJUSTMENT"


class Gender(StrEnum):
    FEMALE = "F"
    MALE = "M"
    OTHER = "X"


class OneTimeTokenPurpose(StrEnum):
    VERIFY_EMAIL = "VERIFY_EMAIL"
    RESET_PASSWORD = "RESET_PASSWORD"
