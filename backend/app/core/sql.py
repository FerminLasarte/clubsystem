"""Helpers de SQL compartidos."""


def contains_pattern(term: str) -> str:
    """Patrón ILIKE "contiene" que trata `%`, `_` y `\\` del usuario como texto literal.
    Usar con `column.ilike(pattern, escape="\\\\")`."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
