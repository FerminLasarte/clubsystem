#!/bin/sh
# Paso previo a cada deploy (Railway: preDeployCommand). Corre con el rol dueño.
# Si falla, el deploy se cancela y sigue sirviendo la versión anterior.
set -eu
alembic upgrade head
python scripts/check_db.py
