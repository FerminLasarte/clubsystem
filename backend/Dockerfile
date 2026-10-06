# Imagen de la API para Railway (o cualquier host de contenedores).
# Build:  docker build -t clubsystem-api backend
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true POETRY_NO_INTERACTION=1
RUN pip install poetry==2.5.1
WORKDIR /app
COPY pyproject.toml poetry.lock poetry.toml ./
RUN poetry install --only main --no-root

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY --from=build /app/.venv .venv
COPY alembic.ini ./
COPY app app
COPY migrations migrations
COPY scripts scripts
USER app
EXPOSE 8000
# Un solo proceso: el scheduler de jobs corre dentro de la API.
# La IP del cliente no sale de X-Forwarded-For (la plataforma conserva lo que manda el
# cliente) sino de TRUSTED_IP_HEADER: ver app/api/rate_limit.py.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --no-server-header"]
