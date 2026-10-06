"""
Envío de emails transaccionales. Por ahora solo hay backend de consola (desarrollo):
antes de producción hay que agregar un proveedor real (SES, Postmark, etc.) acá.
"""

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> None:
    backend = get_settings().EMAIL_BACKEND
    if backend == "console":
        # Solo desarrollo (config lo prohíbe en producción): el cuerpo lleva links con tokens.
        logger.info("EMAIL (consola) a=%s asunto=%r\n%s", to, subject, body)
        return
    # Sin proveedor: no se envía, pero la respuesta HTTP es la misma (no revela si el email
    # existe). Antes de producción hay que agregar un proveedor real acá.
    logger.warning("Envío de email deshabilitado; no se envió %r", subject)


def web_link(path: str) -> str:
    return f"{get_settings().PUBLIC_WEB_URL.rstrip('/')}{path}"
