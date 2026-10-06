"""
Cliente de la API HTTP de Resend (POST /emails). Solo lo usa `app/services/email.py`.

Los destinatarios, los asuntos y los cuerpos llevan datos personales y links con tokens de un
solo uso: no se loguean ni viajan en los errores. Del error de Resend se conserva solo el
código (`name`), nunca el `message`, que puede repetir la dirección.
"""

import httpx

RESEND_API_URL = "https://api.resend.com"


class EmailDeliveryError(Exception):
    """El envío falló. `reason` es seguro para loguear: no tiene datos personales."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _client(timeout: float) -> httpx.AsyncClient:
    # Punto de reemplazo para los tests (transport simulado).
    return httpx.AsyncClient(base_url=RESEND_API_URL, timeout=timeout)


def _field(response: httpx.Response, key: str) -> str | None:
    """Un campo de texto del JSON de la respuesta, o None si no viene o no es JSON."""
    try:
        body = response.json()
    except ValueError:
        return None
    value = body.get(key) if isinstance(body, dict) else None
    return value if isinstance(value, str) else None


async def send(
    *, api_key: str, sender: str, to: str, subject: str, text: str, http_timeout: float
) -> str:
    """Envía un email de texto. Devuelve el id de Resend o lanza EmailDeliveryError."""
    try:
        async with _client(http_timeout) as client:
            response = await client.post(
                "/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"from": sender, "to": [to], "subject": subject, "text": text},
            )
    except httpx.TimeoutException as exc:
        raise EmailDeliveryError(f"Resend no respondió en {http_timeout:g} s") from exc
    except httpx.HTTPError as exc:
        raise EmailDeliveryError(f"error de red con Resend ({type(exc).__name__})") from exc
    if response.is_error:
        code = _field(response, "name") or "sin detalle"
        raise EmailDeliveryError(f"Resend respondió {response.status_code} ({code})")
    return _field(response, "id") or ""
