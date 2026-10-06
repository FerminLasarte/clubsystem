"""
Gastos operativos del club y su análisis estadístico de anomalías.

El análisis corre en SQL dentro del mismo request de alta/edición (sin LLM y sin commits
propios). La explicación con IA llega después, desde el job de app/workers/anomalies.py.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import ColumnElement, Interval, Select, and_, exists, func, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.csv import csv_response
from app.core.errors import BusinessRuleViolation, NotFound
from app.core.time import Period, month_bounds, period_start, today_in, tz, utcnow
from app.domain.anomalies import (
    DUPLICATE_WINDOW_DAYS,
    HISTORY_MONTHS,
    Analysis,
    CategoryHistory,
    Signals,
    analyze,
)
from app.domain.enums import AnomalySeverity, ExpenseCategory
from app.models import Expense
from app.repositories.base import get_scoped, paginate
from app.schemas.common import Page
from app.schemas.expenses import (
    CategoryTotal,
    ExpenseCreate,
    ExpenseFilters,
    ExpenseListParams,
    ExpenseOut,
    ExpenseStatsOut,
    ExpenseUpdate,
    PeriodParams,
    RecomputeOut,
)
from app.services.context import StaffContext

_NOT_FOUND = "Gasto no encontrado."
# Si cambian, la explicación del LLM (que los menciona) deja de valer.
_EXPLAINED_FIELDS = ("category", "description", "amount", "expense_date", "vendor_name")

_CATEGORY_LABELS = {
    ExpenseCategory.MAINTENANCE: "Mantenimiento",
    ExpenseCategory.UTILITIES: "Servicios",
    ExpenseCategory.SALARIES: "Sueldos",
    ExpenseCategory.EQUIPMENT: "Equipamiento",
    ExpenseCategory.MARKETING: "Marketing",
    ExpenseCategory.SUPPLIES: "Insumos",
    ExpenseCategory.OTHER: "Otros",
}
_SEVERITY_LABELS = {
    AnomalySeverity.LOW: "Baja",
    AnomalySeverity.MEDIUM: "Media",
    AnomalySeverity.HIGH: "Alta",
    AnomalySeverity.CRITICAL: "Crítica",
}

DateRange = tuple[date | None, date | None]
# Gasto, cantidad, promedio y desvío del histórico, duplicado, proveedor nuevo.
SignalsSelect = Select[Expense, Any, Any, Any, bool, bool]


@dataclass(frozen=True)
class AnalyzedRow:
    expense: Expense
    signals: Signals


def _vendor_key(column: Any) -> ColumnElement[Any]:
    return func.lower(func.btrim(column))


def signals_stmt(club_id: UUID) -> tuple[SignalsSelect, type[Expense]]:
    """
    Gastos (no borrados) del club con las señales estadísticas de cada uno, calculadas en SQL.
    Devuelve también el alias `e` del gasto analizado, para agregar filtros.
    """
    e = aliased(Expense, name="e")
    hist = aliased(Expense, name="hist")
    dup = aliased(Expense, name="dup")
    seen = aliased(Expense, name="seen")

    history = (
        select(
            func.count(hist.id).label("n"),
            func.avg(hist.amount).label("mean"),
            func.stddev_samp(hist.amount).label("stddev"),
        )
        .where(
            hist.club_id == e.club_id,
            hist.category == e.category,
            hist.id != e.id,
            hist.deleted_at.is_(None),
            hist.expense_date
            >= e.expense_date - func.make_interval(0, HISTORY_MONTHS, type_=Interval()),
            hist.expense_date <= e.expense_date,
        )
        .lateral("history")
    )
    # Duplicado: misma plata y mismo proveedor dentro de ±N días, antes o después.
    has_duplicate = exists().where(
        dup.club_id == e.club_id,
        dup.id != e.id,
        dup.deleted_at.is_(None),
        dup.amount == e.amount,
        _vendor_key(dup.vendor_name) == _vendor_key(e.vendor_name),
        dup.expense_date >= e.expense_date - DUPLICATE_WINDOW_DAYS,
        dup.expense_date <= e.expense_date + DUPLICATE_WINDOW_DAYS,
    )
    vendor_seen_before = exists().where(
        seen.club_id == e.club_id,
        seen.id != e.id,
        seen.deleted_at.is_(None),
        _vendor_key(seen.vendor_name) == _vendor_key(e.vendor_name),
        seen.expense_date <= e.expense_date,
    )
    stmt = (
        select(
            e,
            history.c.n,
            history.c.mean,
            history.c.stddev,
            has_duplicate.label("has_duplicate"),
            and_(e.vendor_name.is_not(None), ~vendor_seen_before).label("is_new_vendor"),
        )
        .join(history, true())
        .where(e.club_id == club_id, e.deleted_at.is_(None))
    )
    return stmt, e


async def load_signals(session: AsyncSession, stmt: SignalsSelect) -> list[AnalyzedRow]:
    rows = (await session.execute(stmt)).all()
    return [
        AnalyzedRow(
            expense=expense,
            signals=Signals(
                amount=expense.amount,
                history=CategoryHistory(count=n, mean=mean, stddev=stddev),
                has_duplicate=bool(has_duplicate),
                is_new_vendor=bool(is_new_vendor),
            ),
        )
        for expense, n, mean, stddev, has_duplicate, is_new_vendor in rows
    ]


def reset_explanation(expense: Expense) -> None:
    expense.anomaly_explanation = None
    expense.anomaly_recommended_action = None
    expense.anomaly_explained_at = None
    expense.anomaly_batch_id = None


def _apply_analysis(expense: Expense, analysis: Analysis) -> None:
    if expense.anomaly_severity != analysis.severity:
        # Cambió el análisis: la explicación y la revisión eran sobre otro resultado.
        reset_explanation(expense)
        expense.reviewed_at = None
        expense.reviewed_by_id = None
    expense.anomaly_score = analysis.score
    expense.anomaly_severity = analysis.severity
    expense.anomaly_reasons = analysis.reasons
    expense.anomaly_analyzed_at = utcnow()


def _period_end(period: Period, start: date) -> date:
    if period == "day":
        return start + timedelta(days=1)
    if period == "week":
        return start + timedelta(days=7)
    if period == "month":
        return month_bounds(start.year, start.month)[1]
    return date(start.year + 1, 1, 1)


def _inclusive_end(end: date | None) -> date | None:
    return end - timedelta(days=1) if end else None


class ExpenseService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    def _range(self, params: PeriodParams, default: Period | None) -> DateRange:
        """[inicio, fin) en fechas locales del club."""
        if params.date_from or params.date_to:
            end = params.date_to + timedelta(days=1) if params.date_to else None
            return params.date_from, end
        period = params.period or default
        if period is None:
            return None, None
        start = period_start(period, today_in(tz(self.ctx.club.timezone)))
        return start, _period_end(period, start)

    def _conditions(
        self, filters: ExpenseFilters, date_range: DateRange
    ) -> list[ColumnElement[bool]]:
        conds: list[ColumnElement[bool]] = [
            Expense.club_id == self.ctx.club_id,
            Expense.deleted_at.is_(None),
        ]
        start, end = date_range
        if start:
            conds.append(Expense.expense_date >= start)
        if end:
            conds.append(Expense.expense_date < end)
        if filters.category:
            conds.append(Expense.category == filters.category)
        if filters.has_anomaly is not None:
            has = Expense.anomaly_severity.is_not(None)
            conds.append(has if filters.has_anomaly else ~has)
        if filters.reviewed is not None:
            reviewed = Expense.reviewed_at.is_not(None)
            conds.append(reviewed if filters.reviewed else ~reviewed)
        return conds

    async def search(self, params: ExpenseListParams) -> Page[ExpenseOut]:
        stmt = (
            select(Expense)
            .where(*self._conditions(params, self._range(params, None)))
            .order_by(Expense.expense_date.desc(), Expense.created_at.desc(), Expense.id)
        )
        rows, total = await paginate(self.db, stmt, params)
        return Page(
            items=[ExpenseOut.model_validate(row[0]) for row in rows],
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

    async def stats(self, filters: ExpenseFilters) -> ExpenseStatsOut:
        date_range = self._range(filters, "month")
        rows = (
            await self.db.execute(
                select(Expense.category, func.count(), func.sum(Expense.amount))
                .where(*self._conditions(filters, date_range))
                .group_by(Expense.category)
                .order_by(func.sum(Expense.amount).desc())
            )
        ).all()
        by_category = [CategoryTotal(category=c, count=n, total=t) for c, n, t in rows]
        pending = (
            await self.db.execute(
                select(func.count()).where(
                    Expense.club_id == self.ctx.club_id,
                    Expense.deleted_at.is_(None),
                    Expense.anomaly_severity.is_not(None),
                    Expense.reviewed_at.is_(None),
                )
            )
        ).scalar_one()
        return ExpenseStatsOut(
            date_from=date_range[0],
            date_to=_inclusive_end(date_range[1]),
            total=sum((c.total for c in by_category), start=Decimal(0)),
            count=sum(c.count for c in by_category),
            by_category=by_category,
            anomalies_pending=pending,
        )

    async def export_csv(self, filters: ExpenseFilters) -> Response:
        start, end = self._range(filters, "month")
        expenses = (
            await self.db.execute(
                select(Expense)
                .where(*self._conditions(filters, (start, end)))
                .order_by(Expense.expense_date, Expense.created_at)
            )
        ).scalars()
        rows: list[list[object]] = []
        total = Decimal(0)
        for e in expenses:
            total += e.amount
            rows.append(
                [
                    e.expense_date,
                    _CATEGORY_LABELS[e.category],
                    e.description,
                    e.vendor_name,
                    e.vendor_tax_id,
                    e.amount,
                    e.currency,
                    _SEVERITY_LABELS.get(e.anomaly_severity) if e.anomaly_severity else None,
                    "Sí" if e.reviewed_at else "No",
                ]
            )
        rows.append(["", "", "TOTAL", "", "", total, "", "", ""])
        label = "_".join(str(d) for d in (start, _inclusive_end(end)) if d) or "todos"
        return csv_response(
            f"gastos_{label}.csv",
            [
                "Fecha",
                "Categoría",
                "Descripción",
                "Proveedor",
                "CUIT",
                "Monto",
                "Moneda",
                "Anomalía",
                "Revisado",
            ],
            rows,
        )

    async def get(self, expense_id: UUID, *, for_update: bool = False) -> Expense:
        expense = await get_scoped(
            self.db,
            Expense,
            expense_id,
            self.ctx.club_id,
            not_found=_NOT_FOUND,
            for_update=for_update,
        )
        if expense.deleted_at is not None:
            raise NotFound(_NOT_FOUND)
        return expense

    async def create(self, data: ExpenseCreate) -> Expense:
        expense = Expense(
            club_id=self.ctx.club_id, created_by_id=self.ctx.user_id, **data.model_dump()
        )
        self.db.add(expense)
        await self.db.flush()
        await self._analyze([expense.id])
        await self.db.refresh(expense)
        return expense

    async def update(self, expense_id: UUID, data: ExpenseUpdate) -> Expense:
        expense = await self.get(expense_id, for_update=True)
        changes = data.model_dump(exclude_unset=True)
        if any(f in changes and changes[f] != getattr(expense, f) for f in _EXPLAINED_FIELDS):
            reset_explanation(expense)
        for field, value in changes.items():
            setattr(expense, field, value)
        await self.db.flush()
        await self._analyze([expense.id])
        await self.db.refresh(expense)
        return expense

    async def delete(self, expense_id: UUID) -> None:
        deleted = (
            await self.db.execute(
                update(Expense)
                .where(
                    Expense.id == expense_id,
                    Expense.club_id == self.ctx.club_id,
                    Expense.deleted_at.is_(None),
                )
                .values(deleted_at=utcnow())
                .returning(Expense.id)
                .execution_options(synchronize_session=False)
            )
        ).scalar_one_or_none()
        if deleted is None:
            raise NotFound(_NOT_FOUND)

    async def review(self, expense_id: UUID) -> Expense:
        expense = await self.get(expense_id, for_update=True)
        if expense.anomaly_severity is None:
            raise BusinessRuleViolation("El gasto no tiene una anomalía para revisar.")
        if expense.reviewed_at is None:
            expense.reviewed_at = utcnow()
            expense.reviewed_by_id = self.ctx.user_id
            await self.db.flush()
            await self.db.refresh(expense)
        return expense

    async def recompute(self, params: PeriodParams) -> RecomputeOut:
        start, end = self._range(params, "month")
        stmt, e = signals_stmt(self.ctx.club_id)
        if start:
            stmt = stmt.where(e.expense_date >= start)
        if end:
            stmt = stmt.where(e.expense_date < end)
        analyzed = await self._apply_rows(await load_signals(self.db, stmt))
        return RecomputeOut(
            analyzed=len(analyzed), flagged=sum(1 for a in analyzed if a.severity is not None)
        )

    async def _analyze(self, ids: Sequence[UUID]) -> None:
        stmt, e = signals_stmt(self.ctx.club_id)
        await self._apply_rows(await load_signals(self.db, stmt.where(e.id.in_(ids))))

    async def _apply_rows(self, rows: list[AnalyzedRow]) -> list[Analysis]:
        results = []
        for row in rows:
            analysis = analyze(row.signals)
            _apply_analysis(row.expense, analysis)
            results.append(analysis)
        await self.db.flush()
        return results
