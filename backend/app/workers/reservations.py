"""Cancela las reservas que siguen pendientes cuando ya pasó su horario de inicio."""

import logging

from sqlalchemy import select

from app.core.db import session_scope, set_tenant_context
from app.models import Club
from app.services.reservations import ReservationService

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
            expired = await ReservationService(session, club_id).expire_unconfirmed()
        if expired:
            logger.info("Reservas pendientes vencidas canceladas: %s (club=%s)", expired, club_id)
