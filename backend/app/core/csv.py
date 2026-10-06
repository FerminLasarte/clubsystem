"""Exportación CSV segura (sin inyección de fórmulas al abrir en Excel/Sheets)."""

import csv
import io
from collections.abc import Iterable, Sequence
from datetime import date, datetime
from decimal import Decimal

from fastapi.responses import Response

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, datetime | date):
        return value.isoformat()
    text = str(value)
    # Los números negativos son datos legítimos; el resto que empieza con estos caracteres
    # se neutraliza con un apóstrofe para que la planilla no lo evalúe.
    if text.startswith(_FORMULA_PREFIXES) and not _is_number(text):
        return "'" + text
    return text


def _is_number(text: str) -> bool:
    try:
        float(text)
    except ValueError:
        return False
    return True


def csv_response(
    filename: str, header: Sequence[str], rows: Iterable[Sequence[object]]
) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow([safe_cell(v) for v in row])
    # BOM para que Excel detecte UTF-8 (acentos).
    return Response(
        content="﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
