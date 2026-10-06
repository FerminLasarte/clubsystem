"""
Envío de emails transaccionales (verificación, reset de contraseña, invitaciones).

Backends (`EMAIL_BACKEND`):
- `console`: solo desarrollo. Loguea el cuerpo, que lleva links con tokens; config lo prohíbe
  en producción.
- `disabled`: no envía nada.
- `resend`: API HTTP de Resend (app/integrations/email/resend_client.py).

Con Resend el envío corre en una tarea aparte y el request no lo espera, por dos motivos:
1. Una falla (timeout, 4xx, 5xx) no puede cambiar la respuesta HTTP.
2. Si "olvidé mi contraseña" esperara a Resend solo cuando la cuenta existe, el tiempo de
   respuesta revelaría qué emails están registrados.
Las fallas se loguean sin destinatario, asunto ni cuerpo; el request_id del log permite
encontrar el request que lo originó.
"""

import asyncio
import logging

from app.core.config import get_settings
from app.integrations.email import resend_client
from app.integrations.email.resend_client import EmailDeliveryError

logger = logging.getLogger(__name__)

# Referencias fuertes a los envíos en curso (asyncio solo guarda referencias débiles).
_pending: set[asyncio.Task[None]] = set()


async def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if settings.EMAIL_BACKEND == "console":
        logger.info("EMAIL (consola) a=%s asunto=%r\n%s", to, subject, body)
        return
    if settings.EMAIL_BACKEND == "disabled":
        # La respuesta HTTP es la misma que si se enviara: no revela si el email existe.
        logger.warning("Envío de email deshabilitado (EMAIL_BACKEND=disabled)")
        return
    task = asyncio.create_task(_deliver(to, subject, body))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def _deliver(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    api_key, sender = settings.RESEND_API_KEY, settings.EMAIL_FROM
    if api_key is None or sender is None:  # Settings lo valida; esto no debería pasar
        logger.error("No se pudo enviar un email: falta RESEND_API_KEY o EMAIL_FROM")
        return
    try:
        message_id = await resend_client.send(
            api_key=api_key.get_secret_value(),
            sender=sender,
            to=to,
            subject=subject,
            text=body,
            http_timeout=settings.EMAIL_TIMEOUT_SECONDS,
        )
    except EmailDeliveryError as exc:
        logger.error("No se pudo enviar un email: %s", exc.reason)
        return
    logger.info("Email enviado (id de Resend %s)", message_id or "desconocido")


async def wait_for_pending(grace_seconds: float) -> None:
    """Espera los envíos en curso, como mucho `grace_seconds`: al apagar la app y en los tests."""
    if _pending:
        await asyncio.wait(set(_pending), timeout=grace_seconds)


def web_link(path: str) -> str:
    return f"{get_settings().PUBLIC_WEB_URL.rstrip('/')}{path}"
