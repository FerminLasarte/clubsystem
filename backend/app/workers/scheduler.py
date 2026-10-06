"""
Tareas periódicas dentro del proceso de la API (asyncio). Con varias réplicas, cada tarea
debe ser idempotente: las actuales lo son (UPDATE condicionales).
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)

Job = tuple[str, float, Callable[[], Awaitable[None]]]


def _jobs() -> list[Job]:
    from app.workers.anomalies import explain_anomalies
    from app.workers.reservations import expire_unconfirmed_reservations

    return [
        ("expire_unconfirmed_reservations", 300.0, expire_unconfirmed_reservations),
        ("explain_anomalies", 60.0, explain_anomalies),
    ]


def start_scheduler() -> Callable[[], Awaitable[None]]:
    async def _loop(name: str, interval: float, job: Callable[[], Awaitable[None]]) -> None:
        while True:
            try:
                await job()
            except Exception:
                logger.exception("Falló el job %s", name)
            await asyncio.sleep(interval)

    tasks = [asyncio.create_task(_loop(*job), name=job[0]) for job in _jobs()]

    async def stop() -> None:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    return stop
