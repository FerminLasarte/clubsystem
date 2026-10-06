"""
Configuración única de logging. Cada línea lleva request_id, user_id y club_id del request
en curso (contextvars), así no hace falta repetirlos en cada llamada a logger.
"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
club_id_var: ContextVar[str | None] = ContextVar("club_id", default=None)


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.user_id = user_id_var.get()
        record.club_id = club_id_var.get()
        return True


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "user_id": getattr(record, "user_id", None),
            "club_id": getattr(record, "club_id", None),
        }
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


def configure_logging(level: str = "INFO", *, json_output: bool = False) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_ContextFilter())
    handler.setFormatter(
        _JsonFormatter()
        if json_output
        else logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s [req=%(request_id)s club=%(club_id)s] %(message)s"
        )
    )
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # El log de SQL nunca se activa por configuración general: puede llevar datos sensibles.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
