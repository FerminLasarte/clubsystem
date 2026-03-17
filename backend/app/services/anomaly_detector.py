# backend/app/services/anomaly_detector.py
"""
ClubSync — Anomaly Detector Service
=====================================
Fase 1: Detección estadística (Z-score, duplicados, proveedor nuevo, montos redondos).
Fase 2: Explicación contextual con LLM (OpenAI gpt-4o-mini).
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, cast, String, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense

logger = logging.getLogger(__name__)


@dataclass
class AnomalyAnalysis:
    score: float                          # 0.0 (normal) → 1.0 (muy anómalo)
    severity: Optional[str]               # None | 'low' | 'medium' | 'high' | 'critical'
    reason: Optional[str]                 # Explicación estadística en español
    llm_explanation: Optional[str] = None # Explicación enriquecida por LLM


class AnomalyDetectorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze(self, expense: Expense) -> AnomalyAnalysis:
        """
        Analiza un gasto y devuelve un score de anomalía.
        Combina múltiples señales estadísticas + explicación LLM.
        """
        signals: list[tuple[float, str]] = []  # (score, reason)

        # ── Señal 1: Z-score por categoría ───────────────────
        historical = await self._get_historical_amounts(
            expense.club_id, str(expense.category)
        )
        if len(historical) >= 5:
            z_score = self._zscore(float(expense.amount), historical)
            if z_score > 0.3:
                mean = statistics.mean(historical)
                pct = ((float(expense.amount) - mean) / mean) * 100
                direction = "por encima" if float(expense.amount) > mean else "por debajo"
                signals.append((
                    z_score,
                    f"Monto {abs(pct):.0f}% {direction} del promedio histórico "
                    f"para {expense.category} (promedio: ${mean:,.0f})"
                ))

        # ── Señal 2: Proveedor nuevo con monto alto ───────────
        if expense.vendor_name:
            is_new_vendor = await self._is_new_vendor(
                expense.club_id, expense.vendor_name, expense.id
            )
            if is_new_vendor and float(expense.amount) > 50_000:
                signals.append((
                    0.5,
                    f"Proveedor nuevo '{expense.vendor_name}' con monto elevado"
                ))

        # ── Señal 3: Monto redondo sospechoso ────────────────
        amount = float(expense.amount)
        if amount >= 10_000 and amount % 10_000 == 0:
            signals.append((0.2, "Monto en número redondo exacto"))

        # ── Señal 4: Gasto duplicado (mismo proveedor + monto + ±7 días) ──
        is_dup = await self._check_duplicate(expense)
        if is_dup:
            signals.append((0.8, "Posible gasto duplicado — mismo proveedor y monto en los últimos 7 días"))

        # ── Combinar señales ──────────────────────────────────
        if not signals:
            return AnomalyAnalysis(score=0.0, severity=None, reason=None)

        final_score = min(max(s for s, _ in signals), 1.0)
        reasons = [r for _, r in signals]
        combined_reason = " · ".join(reasons)
        severity = self._score_to_severity(final_score)

        # ── Fase 2: Explicación LLM (solo si score alto) ─────
        llm_explanation = None
        if severity and final_score >= 0.5:
            llm_explanation = await self._llm_explain(
                expense, final_score, combined_reason, historical
            )

        return AnomalyAnalysis(
            score=round(final_score, 3),
            severity=severity,
            reason=combined_reason,
            llm_explanation=llm_explanation,
        )

    async def analyze_bulk(self, club_id: UUID) -> dict[str, AnomalyAnalysis]:
        """
        Analiza todos los gastos sin anomalía de un club.
        Útil para correr en background o al iniciar sesión.
        """
        result = await self.db.execute(
            select(Expense).where(
                Expense.club_id == club_id,
                Expense.anomaly_severity.is_(None),
                Expense.anomaly_score.is_(None),
            )
        )
        expenses = result.scalars().all()
        analyses = {}
        for expense in expenses:
            analyses[str(expense.id)] = await self.analyze(expense)
        return analyses

    # ── Helpers privados ──────────────────────────────────────

    async def _get_historical_amounts(
        self, club_id: UUID, category: str, days: int = 90
    ) -> list[float]:
        cutoff = date.today() - timedelta(days=days)
        cat_col = cast(Expense.category, String)
        result = await self.db.execute(
            select(Expense.amount).where(
                Expense.club_id == club_id,
                cat_col == category,
                Expense.expense_date >= cutoff,
            )
        )
        return [float(r) for r in result.scalars()]

    async def _is_new_vendor(
        self, club_id: UUID, vendor_name: str, exclude_id: UUID
    ) -> bool:
        result = await self.db.execute(
            select(Expense.id).where(
                Expense.club_id == club_id,
                Expense.vendor_name == vendor_name,
                Expense.id != exclude_id,
            ).limit(1)
        )
        return result.scalar_one_or_none() is None

    async def _check_duplicate(self, expense: Expense) -> bool:
        if not expense.vendor_name:
            return False
        cutoff = expense.expense_date - timedelta(days=7)
        result = await self.db.execute(
            select(Expense.id).where(
                Expense.club_id == expense.club_id,
                Expense.vendor_name == expense.vendor_name,
                Expense.amount == expense.amount,
                Expense.expense_date >= cutoff,
                Expense.id != expense.id,
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    # ── Fase 2: LLM Contextual Explainer ─────────────────────

    async def _llm_explain(
        self,
        expense: Expense,
        score: float,
        statistical_reason: str,
        historical: list[float],
    ) -> Optional[str]:
        """
        Genera una explicación en lenguaje natural usando Gemini (primario) u OpenAI (fallback).
        Si ninguna API key está configurada, retorna None.
        """
        from app.core.config import settings

        # Construir contexto histórico
        hist_summary = ""
        if historical:
            mean = statistics.mean(historical)
            stdev = statistics.stdev(historical) if len(historical) >= 2 else 0
            hist_summary = (
                f"Datos históricos (últimos 90 días, categoría '{expense.category}'): "
                f"{len(historical)} gastos, promedio ${mean:,.0f}, desviación ${stdev:,.0f}, "
                f"rango ${min(historical):,.0f} – ${max(historical):,.0f}."
            )

        system_prompt = (
            "Sos un asistente financiero especializado en clubes deportivos en Argentina. "
            "Te dan un gasto que fue marcado como anómalo por el sistema de detección automática. "
            "Tu trabajo es explicar en 2-3 oraciones claras y concisas POR QUÉ este gasto "
            "podría ser problemático y QUÉ debería hacer el administrador. "
            "Respondé siempre en español rioplatense (voseo). "
            "No inventes datos que no tengas. Sé directo y útil."
        )

        user_prompt = (
            f"Gasto flaggeado como anomalía (score: {score:.2f}):\n"
            f"- Categoría: {expense.category}\n"
            f"- Descripción: {expense.description}\n"
            f"- Monto: ${float(expense.amount):,.0f} {expense.currency}\n"
            f"- Fecha: {expense.expense_date}\n"
            f"- Proveedor: {expense.vendor_name or 'No especificado'}\n"
            f"- Razón estadística: {statistical_reason}\n"
            f"\n{hist_summary}\n"
            f"\nExplicá por qué este gasto es sospechoso y qué debería revisar el admin."
        )

        # ── Prioridad 1: Gemini ──────────────────────────────
        if settings.GEMINI_API_KEY:
            try:
                from google import genai

                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=f"{system_prompt}\n\n{user_prompt}",
                    config={
                        "max_output_tokens": 250,
                        "temperature": 0.3,
                    },
                )
                return response.text.strip()
            except Exception as e:
                logger.warning(f"Error con Gemini, intentando OpenAI: {e}")

        # ── Prioridad 2: OpenAI (fallback) ───────────────────
        if settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                response = await client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=250,
                    temperature=0.3,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.warning(f"Error con OpenAI: {e}")

        logger.debug("Ninguna API key de LLM configurada — omitiendo explicación")
        return None

    @staticmethod
    def _zscore(value: float, population: list[float]) -> float:
        if len(population) < 3:
            return 0.0
        mean = statistics.mean(population)
        try:
            stdev = statistics.stdev(population)
        except statistics.StatisticsError:
            return 0.0
        if stdev == 0:
            return 0.0
        z = abs((value - mean) / stdev)
        return min(z / 3.0, 1.0)

    @staticmethod
    def _score_to_severity(score: float) -> Optional[str]:
        if score < 0.35:
            return None
        if score < 0.55:
            return "low"
        if score < 0.75:
            return "medium"
        if score < 0.90:
            return "high"
        return "critical"
