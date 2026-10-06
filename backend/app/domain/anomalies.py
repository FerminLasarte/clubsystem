"""
Detección estadística de anomalías en gastos (reglas puras, sin I/O).

La severidad la decide SIEMPRE esta estadística. El LLM solo redacta una explicación
después, en background, y nunca la modifica.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

from app.domain.enums import AnomalySeverity

HISTORY_MONTHS = 12
MIN_HISTORY = 5
DUPLICATE_WINDOW_DAYS = 7

Z_SIGNAL = 2.0
Z_FULL_SCORE = 4.0
DUPLICATE_SCORE = 0.8
NEW_VENDOR_SCORE = 0.6
NEW_VENDOR_FACTOR = 2
EXTRA_SIGNAL_BONUS = 0.1
# Con un histórico de montos idénticos el desvío es 0 y cualquier diferencia daría z infinito.
MIN_STDDEV_RATIO = Decimal("0.05")

# Severidades que merecen una explicación del LLM.
EXPLAINED_SEVERITIES = frozenset(
    {AnomalySeverity.MEDIUM, AnomalySeverity.HIGH, AnomalySeverity.CRITICAL}
)

ExplanationStatus = Literal["not_needed", "pending", "ready", "unavailable"]


@dataclass(frozen=True)
class CategoryHistory:
    """Gastos de la misma categoría en los 12 meses previos, sin el propio ni los borrados."""

    count: int
    mean: Decimal | None
    stddev: Decimal | None


@dataclass(frozen=True)
class Signals:
    amount: Decimal
    history: CategoryHistory
    has_duplicate: bool
    is_new_vendor: bool


@dataclass(frozen=True)
class Analysis:
    score: float
    severity: AnomalySeverity | None
    reasons: str | None


def format_money(value: Decimal) -> str:
    """$ 1.234,56 (formato argentino)."""
    text = f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"$ {text}"


def z_score(amount: Decimal, history: CategoryHistory) -> float | None:
    if history.count < MIN_HISTORY or history.mean is None or history.mean <= 0:
        return None
    stddev = max(history.stddev or Decimal(0), history.mean * MIN_STDDEV_RATIO)
    return float((amount - history.mean) / stddev)


def severity_for(score: float) -> AnomalySeverity | None:
    if score < 0.35:
        return None
    if score < 0.55:
        return AnomalySeverity.LOW
    if score < 0.75:
        return AnomalySeverity.MEDIUM
    if score < 0.9:
        return AnomalySeverity.HIGH
    return AnomalySeverity.CRITICAL


def analyze(signals: Signals) -> Analysis:
    found: list[tuple[float, str]] = []
    history = signals.history

    # Solo preocupan los montos más altos de lo habitual: un gasto bajo no es un riesgo.
    z = z_score(signals.amount, history)
    if z is not None and z >= Z_SIGNAL and history.mean is not None:
        above = (signals.amount / history.mean - 1) * 100
        found.append(
            (
                min(z / Z_FULL_SCORE, 1.0),
                f"Monto {above:.0f}% por encima del promedio de la categoría en los últimos "
                f"{HISTORY_MONTHS} meses ({format_money(history.mean)} en {history.count} gastos).",
            )
        )
    if signals.has_duplicate:
        found.append(
            (
                DUPLICATE_SCORE,
                "Posible duplicado: hay otro gasto del mismo proveedor y por el mismo monto "
                f"con {DUPLICATE_WINDOW_DAYS} días o menos de diferencia.",
            )
        )
    if (
        signals.is_new_vendor
        and history.count >= MIN_HISTORY
        and history.mean is not None
        and signals.amount >= history.mean * NEW_VENDOR_FACTOR
    ):
        found.append(
            (
                NEW_VENDOR_SCORE,
                "Proveedor nuevo con un monto de al menos el doble del promedio de la categoría.",
            )
        )

    if not found:
        return Analysis(score=0.0, severity=None, reasons=None)
    found.sort(key=lambda item: item[0], reverse=True)
    score = round(min(found[0][0] + EXTRA_SIGNAL_BONUS * (len(found) - 1), 1.0), 3)
    return Analysis(
        score=score, severity=severity_for(score), reasons=" · ".join(r for _, r in found)
    )


def explanation_status(
    severity: AnomalySeverity | None,
    explanation: str | None,
    explained_at: datetime | None,
    *,
    llm_enabled: bool,
) -> ExplanationStatus:
    if severity not in EXPLAINED_SEVERITIES:
        return "not_needed"
    if explanation:
        return "ready"
    # explained_at sin texto: el LLM declinó o devolvió algo inválido; no se reintenta.
    if explained_at is not None or not llm_enabled:
        return "unavailable"
    return "pending"
