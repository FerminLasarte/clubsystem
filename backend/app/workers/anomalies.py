"""Genera con el LLM las explicaciones de los gastos marcados como anómalos."""

import logging

from sqlalchemy import select

from app.core.db import session_scope
from app.integrations.llm.anthropic_client import get_client
from app.models import Club
from app.services.anomaly_explanations import explain_club

logger = logging.getLogger(__name__)


async def explain_anomalies() -> None:
    client = get_client()
    if client is None:
        logger.debug("Sin ANTHROPIC_API_KEY: no se generan explicaciones de anomalías")
        return
    async with session_scope() as session:
        clubs = (
            await session.execute(select(Club.id, Club.timezone).where(Club.is_active.is_(True)))
        ).all()
    for club_id, timezone in clubs:
        run = await explain_club(client, club_id, timezone)
        if run.explained or run.unavailable or run.batched:
            logger.info(
                "Explicaciones de anomalías: %s listas, %s no disponibles, %s en batch (club=%s)",
                run.explained,
                run.unavailable,
                run.batched,
                club_id,
            )
        if run.rate_limited:
            logger.warning("Anthropic limitó la tasa; se sigue en la próxima corrida")
            return
