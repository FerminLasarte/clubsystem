"""
Envío de emails transaccionales. Por ahora solo hay backend de consola (desarrollo):
antes de producción hay que agregar un proveedor real (SES, Postmark, etc.) acá.
"""

import logging

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> None:
    backend = get_settings().EMAIL_BACKEND
    if backend == "console":
        logger.info("EMAIL (consola) a=%s asunto=%r\n%s", to, subject, body)
        return
    raise ServiceUnavailable("El envío de emails no está configurado.")


def web_link(path: str) -> str:
    return f"{get_settings().PUBLIC_WEB_URL.rstrip('/')}{path}"
