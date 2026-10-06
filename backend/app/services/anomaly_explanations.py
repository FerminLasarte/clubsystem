"""
Explicaciones de anomalías con el LLM, en background (nunca dentro de un request).

Por club: se leen los pendientes, se llama al modelo FUERA de la transacción (no se retiene
una conexión durante la llamada) y se guarda con un UPDATE condicional: si el gasto cambió
mientras tanto, el resultado se descarta y el gasto vuelve a quedar pendiente.
Con muchos pendientes se usa la Batch API (más barata); el id del batch queda en el gasto.
"""

import asyncio
import logging
from collections.abc import Awaitable
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import anthropic
from anthropic import AsyncAnthropic
from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import session_scope, set_tenant_context
from app.core.time import day_bounds, today_in, tz, utcnow
from app.domain.anomalies import EXPLAINED_SEVERITIES, HISTORY_MONTHS
from app.domain.enums import AnomalySeverity, ExpenseCategory
from app.integrations.llm import anthropic_client as llm
from app.models import Expense
from app.services.expenses import AnalyzedRow, load_signals, signals_stmt

logger = logging.getLogger(__name__)

BATCH_MIN = 20
CONCURRENCY = 3


@dataclass(frozen=True)
class PendingExpense:
    """Lo que se mandó al modelo: si el gasto ya no coincide, el resultado no se guarda."""

    id: UUID
    category: ExpenseCategory
    description: str
    amount: Decimal
    expense_date: date
    vendor_name: str | None
    severity: AnomalySeverity
    payload: dict[str, Any]


@dataclass
class ClubRun:
    explained: int = 0
    unavailable: int = 0
    batched: int = 0
    rate_limited: bool = False


def _payload(row: AnalyzedRow) -> dict[str, Any]:
    """Solo lo necesario para explicar: nada de datos de socios ni notas internas."""
    e, history = row.expense, row.signals.history
    return {
        "categoria": e.category.value,
        "monto": str(e.amount),
        "moneda": e.currency,
        "fecha": e.expense_date.isoformat(),
        "proveedor": e.vendor_name,
        "descripcion": e.description,
        "analisis_estadistico": {
            "severidad": e.anomaly_severity.value if e.anomaly_severity else None,
            "puntaje": e.anomaly_score,
            "senales": e.anomaly_reasons,
            f"historial_categoria_{HISTORY_MONTHS}_meses": {
                "cantidad": history.count,
                "promedio": str(round(history.mean, 2)) if history.mean is not None else None,
                "desvio": str(round(history.stddev, 2)) if history.stddev is not None else None,
            },
        },
    }


class ExplanationStore:
    """Queries del job. La sesión ya tiene el contexto RLS del club."""

    def __init__(self, session: AsyncSession, club_id: UUID) -> None:
        self.db = session
        self.club_id = club_id

    def _base(self) -> list[ColumnElement[bool]]:
        return [Expense.club_id == self.club_id, Expense.anomaly_explained_at.is_(None)]

    async def used_today(self, timezone: str) -> int:
        """Explicaciones del día (incluye las que el modelo no pudo dar) + pedidas en batch."""
        zone = tz(timezone)
        start, end = day_bounds(today_in(zone), zone)
        stmt = select(func.count()).where(
            Expense.club_id == self.club_id,
            or_(
                (Expense.anomaly_explained_at >= start) & (Expense.anomaly_explained_at < end),
                Expense.anomaly_explained_at.is_(None) & Expense.anomaly_batch_id.is_not(None),
            ),
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def pending(self, limit: int) -> list[PendingExpense]:
        stmt, e = signals_stmt(self.club_id)
        stmt = (
            stmt.where(
                e.anomaly_severity.in_(EXPLAINED_SEVERITIES),
                e.anomaly_explained_at.is_(None),
                e.anomaly_explanation.is_(None),
                e.anomaly_batch_id.is_(None),
            )
            .order_by(e.created_at)
            .limit(limit)
        )
        rows = await load_signals(self.db, stmt)
        return [
            PendingExpense(
                id=row.expense.id,
                category=row.expense.category,
                description=row.expense.description,
                amount=row.expense.amount,
                expense_date=row.expense.expense_date,
                vendor_name=row.expense.vendor_name,
                severity=AnomalySeverity(row.expense.anomaly_severity),
                payload=_payload(row),
            )
            for row in rows
        ]

    async def in_flight_batches(self) -> list[str]:
        stmt = (
            select(Expense.anomaly_batch_id)
            .where(*self._base(), Expense.anomaly_batch_id.is_not(None))
            .distinct()
        )
        return [b for b in (await self.db.execute(stmt)).scalars() if b]

    async def attach_batch(self, ids: list[UUID], batch_id: str) -> None:
        await self.db.execute(
            update(Expense)
            .where(*self._base(), Expense.id.in_(ids), Expense.anomaly_batch_id.is_(None))
            .values(anomaly_batch_id=batch_id)
            .execution_options(synchronize_session=False)
        )

    async def save(self, item: PendingExpense, outcome: llm.ExplanationOutcome) -> bool:
        guard = [
            Expense.id == item.id,
            Expense.deleted_at.is_(None),
            Expense.anomaly_explanation.is_(None),
            Expense.anomaly_batch_id.is_(None),
            Expense.anomaly_severity == item.severity,
            Expense.category == item.category,
            Expense.description == item.description,
            Expense.amount == item.amount,
            Expense.expense_date == item.expense_date,
            Expense.vendor_name.is_not_distinct_from(item.vendor_name),
        ]
        return await self._store(guard, item.id, outcome)

    async def save_batch_result(
        self, batch_id: str, expense_id: UUID, outcome: llm.ExplanationOutcome
    ) -> bool:
        # Cualquier cambio relevante del gasto limpia anomaly_batch_id: así se detecta.
        guard = [
            Expense.id == expense_id,
            Expense.deleted_at.is_(None),
            Expense.anomaly_batch_id == batch_id,
        ]
        return await self._store(guard, expense_id, outcome)

    async def release_batch(self, batch_id: str) -> None:
        """Lo que el batch no resolvió vuelve a quedar pendiente."""
        await self.db.execute(
            update(Expense)
            .where(Expense.club_id == self.club_id, Expense.anomaly_batch_id == batch_id)
            .values(anomaly_batch_id=None)
            .execution_options(synchronize_session=False)
        )

    async def _store(
        self, guard: list[ColumnElement[bool]], expense_id: UUID, outcome: llm.ExplanationOutcome
    ) -> bool:
        if outcome.refusal_category:
            logger.warning(
                "El modelo declinó explicar el gasto %s (categoría=%s)",
                expense_id,
                outcome.refusal_category,
            )
        now: datetime = utcnow()
        saved = (
            await self.db.execute(
                update(Expense)
                .where(*self._base(), *guard)
                .values(
                    anomaly_explanation=outcome.explanation,
                    anomaly_recommended_action=outcome.recommended_action,
                    anomaly_explained_at=now,
                    anomaly_batch_id=None,
                )
                .returning(Expense.id)
                .execution_options(synchronize_session=False)
            )
        ).scalar_one_or_none()
        return saved is not None


class _RateLimited(Exception):
    pass


async def _api[T](call: Awaitable[T], what: str) -> T | None:
    """Errores de la API: se loguean y se reintenta en la próxima corrida del job."""
    try:
        return await call
    except anthropic.RateLimitError as exc:
        raise _RateLimited from exc
    except anthropic.APIStatusError as exc:
        logger.warning("Anthropic respondió %s al %s", exc.status_code, what)
    except anthropic.APITimeoutError:
        logger.warning("Timeout de Anthropic al %s", what)
    except anthropic.APIConnectionError:
        logger.warning("Sin conexión con Anthropic al %s", what)
    return None


async def _poll_batch(
    client: AsyncAnthropic, batch_id: str
) -> dict[str, llm.ExplanationOutcome] | None:
    try:
        return await llm.batch_outcomes(client, batch_id)
    except anthropic.NotFoundError:
        logger.warning("El batch %s ya no existe; sus gastos vuelven a quedar pendientes", batch_id)
        return {}


async def _explain_each(
    client: AsyncAnthropic, items: list[PendingExpense], run: ClubRun
) -> list[tuple[PendingExpense, llm.ExplanationOutcome]]:
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def one(item: PendingExpense) -> llm.ExplanationOutcome | None:
        async with semaphore:
            if run.rate_limited:
                return None
            try:
                return await _api(llm.explain(client, item.payload), "explicar un gasto")
            except _RateLimited:
                run.rate_limited = True
                return None

    outcomes = await asyncio.gather(*(one(item) for item in items))
    return [(item, o) for item, o in zip(items, outcomes, strict=True) if o is not None]


def _count(run: ClubRun, outcome: llm.ExplanationOutcome) -> None:
    if outcome.explanation:
        run.explained += 1
    else:
        run.unavailable += 1


async def _collect_batches(client: AsyncAnthropic, club_id: UUID, run: ClubRun) -> None:
    async with session_scope() as session:
        await set_tenant_context(session, club_id=club_id)
        batch_ids = await ExplanationStore(session, club_id).in_flight_batches()
    for batch_id in batch_ids:
        outcomes = await _api(_poll_batch(client, batch_id), "consultar un batch")
        if outcomes is None:
            continue
        async with session_scope() as session:
            await set_tenant_context(session, club_id=club_id)
            store = ExplanationStore(session, club_id)
            for custom_id, outcome in outcomes.items():
                if await store.save_batch_result(batch_id, UUID(hex=custom_id), outcome):
                    _count(run, outcome)
            await store.release_batch(batch_id)


async def explain_club(client: AsyncAnthropic, club_id: UUID, timezone: str) -> ClubRun:
    run = ClubRun()
    try:
        await _collect_batches(client, club_id, run)

        async with session_scope() as session:
            await set_tenant_context(session, club_id=club_id)
            store = ExplanationStore(session, club_id)
            budget = get_settings().ANOMALY_LLM_DAILY_LIMIT_PER_CLUB
            remaining = budget - await store.used_today(timezone)
            pending = await store.pending(remaining) if remaining > 0 else []
        if not pending:
            return run

        if len(pending) >= BATCH_MIN:
            requests = [llm.batch_request(item.id.hex, item.payload) for item in pending]
            batch_id = await _api(llm.submit_batch(client, requests), "crear un batch")
            if batch_id is not None:
                async with session_scope() as session:
                    await set_tenant_context(session, club_id=club_id)
                    await ExplanationStore(session, club_id).attach_batch(
                        [item.id for item in pending], batch_id
                    )
                run.batched = len(pending)
            return run

        results = await _explain_each(client, pending, run)
        async with session_scope() as session:
            await set_tenant_context(session, club_id=club_id)
            store = ExplanationStore(session, club_id)
            for item, outcome in results:
                if await store.save(item, outcome):
                    _count(run, outcome)
    except _RateLimited:
        run.rate_limited = True
    return run
