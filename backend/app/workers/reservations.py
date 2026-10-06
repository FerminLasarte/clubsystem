"""
Transiciones de reservas por tiempo: cancela las pendientes cuyo inicio ya pasó sin
confirmarse y marca completadas las confirmadas que ya terminaron.
"""

import logging

from sqlalchemy import select

from app.core.db import session_scope, set_tenant_context
from app.models import Club
from app.services.reservations import run_transitions

logger = logging.getLogger(__name__)


async def expire_unconfirmed_reservations() -> None:
    async with session_scope() as session:
        club_ids = (
            await session.execute(select(Club.id).where(Club.is_active.is_(True)))
        ).scalars()
        club_ids = list(club_ids)
    for club_id in club_ids:
        # Una transacción por club, con su contexto de RLS.
        async with session_scope() as session:
            await set_tenant_context(session, club_id=club_id)
            result = await run_transitions(session, club_id)
        if result.expired or result.completed:
            logger.info(
                "Reservas: %s pendientes vencidas canceladas, %s completadas (club=%s)",
                result.expired,
                result.completed,
                club_id,
            )
