"""Imprime el esquema OpenAPI de la API (sin levantar el servidor ni conectar a la base)."""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused@localhost/unused")
os.environ.setdefault("MIGRATIONS_DATABASE_URL", "postgresql+asyncpg://unused@localhost/unused")
os.environ.setdefault("JWT_SECRET_KEY", "openapi-export-" + "x" * 32)

from app.main import app

json.dump(app.openapi(), sys.stdout, indent=2, ensure_ascii=False, sort_keys=True)
sys.stdout.write("\n")
