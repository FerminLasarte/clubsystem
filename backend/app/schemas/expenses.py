from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, computed_field, model_validator

from app.core.time import Period
from app.domain.anomalies import ExplanationStatus, explanation_status
from app.domain.enums import AnomalySeverity, ExpenseCategory
from app.integrations.llm.anthropic_client import is_configured as llm_configured
from app.schemas.common import OptionalText, PageParams, PositiveMoney, Schema

Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
VendorName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
TaxId = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]

_REQUIRED_ON_UPDATE = ("category", "description", "amount", "expense_date")


class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    description: Description
    amount: PositiveMoney
    expense_date: date
    vendor_name: VendorName | None = None
    vendor_tax_id: TaxId | None = None
    notes: OptionalText | None = None


class ExpenseUpdate(BaseModel):
    """Solo se modifican los campos enviados. `null` limpia los opcionales."""

    category: ExpenseCategory | None = None
    description: Description | None = None
    amount: PositiveMoney | None = None
    expense_date: date | None = None
    vendor_name: VendorName | None = None
    vendor_tax_id: TaxId | None = None
    notes: OptionalText | None = None

    @model_validator(mode="after")
    def _required_not_null(self) -> Self:
        cleared = [
            f
            for f in _REQUIRED_ON_UPDATE
            if f in self.model_fields_set and getattr(self, f) is None
        ]
        if cleared:
            raise ValueError(f"Estos campos no se pueden borrar: {', '.join(cleared)}")
        return self


class PeriodParams(BaseModel):
    """Un período en la zona del club, o un rango de fechas (ambos extremos incluidos)."""

    period: Period | None = None
    date_from: date | None = None
    date_to: date | None = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.period and (self.date_from or self.date_to):
            raise ValueError("Usá `period` o `date_from`/`date_to`, no ambos.")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("`date_from` no puede ser posterior a `date_to`.")
        return self


class ExpenseFilters(PeriodParams):
    category: ExpenseCategory | None = None
    has_anomaly: bool | None = None
    reviewed: bool | None = None


class ExpenseListParams(ExpenseFilters, PageParams):
    pass


class ExpenseOut(Schema):
    id: UUID
    category: ExpenseCategory
    description: str
    amount: Decimal
    currency: str
    expense_date: date
    vendor_name: str | None
    vendor_tax_id: str | None
    notes: str | None
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
    anomaly_score: float | None
    anomaly_severity: AnomalySeverity | None
    anomaly_reasons: str | None
    anomaly_analyzed_at: datetime | None
    # Generadas por IA: la UI debe mostrarlas como tales.
    anomaly_explanation: str | None
    anomaly_recommended_action: str | None
    anomaly_explained_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by_id: UUID | None

    @computed_field
    @property
    def explanation_status(self) -> ExplanationStatus:
        return explanation_status(
            self.anomaly_severity,
            self.anomaly_explanation,
            self.anomaly_explained_at,
            llm_enabled=llm_configured(),
        )


class CategoryTotal(BaseModel):
    category: ExpenseCategory
    total: Decimal
    count: int


class ExpenseStatsOut(BaseModel):
    date_from: date | None
    date_to: date | None = Field(description="Incluido.")
    total: Decimal
    count: int
    by_category: list[CategoryTotal]
    anomalies_pending: int = Field(
        description="Gastos con anomalía sin revisar, de cualquier fecha."
    )


class RecomputeOut(BaseModel):
    analyzed: int
    flagged: int
