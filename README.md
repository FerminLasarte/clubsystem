# ClubSystem

SaaS multi-tenant para la gestión de clubes deportivos.

| Parte | Stack | Para quién |
|---|---|---|
| `backend/` | FastAPI · SQLAlchemy 2 (async) · PostgreSQL 17 · Alembic | API única |
| `apps/web/` | Next.js 16 (App Router) · TanStack Query · Tailwind v4 · shadcn/ui | Panel del staff del club |
| `apps/mobile/` | Expo · Expo Router · TanStack Query | App de los socios |
| `packages/api/` | Tipos generados desde OpenAPI + cliente HTTP (`openapi-fetch`) | Web y mobile |
| `packages/shared/` | Formato (moneda, fechas en la zona del club) y etiquetas | Web y mobile |

Las reglas de arquitectura y de trabajo están en [`CLAUDE.md`](CLAUDE.md). La auditoría que originó el rediseño, y sus decisiones, en [`docs/audit/AUDIT.md`](docs/audit/AUDIT.md).

## Requisitos

- Node ≥ 20 y pnpm 9 (`corepack enable` o `npm i -g pnpm@9`)
- Python 3.12 o 3.13 y [Poetry](https://python-poetry.org/)
- Docker, para Postgres local (o un PostgreSQL 17 propio con los roles de `backend/docker/init-db.sql`)

## Puesta en marcha

```bash
pnpm install
```

```bash
cd backend && docker compose up -d db
```

```bash
cd backend && cp .env.example .env
```

Completá `JWT_SECRET_KEY` en `backend/.env` (instrucciones en el archivo). Después:

```bash
cd backend && poetry install && poetry run alembic upgrade head && poetry run python scripts/seed_dev.py
```

El seed imprime la contraseña de las cuentas de demo: `owner@demo.example.com` para el panel y `socio1@demo.example.com` para la app.

```bash
cd backend && poetry run uvicorn app.main:app --reload
```

```bash
pnpm --filter web dev
```

```bash
pnpm --filter mobile dev
```

- API: http://localhost:8000. La documentación interactiva está en `/docs`, salvo en producción.
- Panel: http://localhost:3000. Next reenvía `/api/*` al backend (`BACKEND_URL`), así que la sesión viaja en cookies HttpOnly del mismo origen.
- App: Expo usa `EXPO_PUBLIC_API_URL`, que por defecto es `http://localhost:8000`.

## Tareas habituales

| Qué | Comando |
|---|---|
| Lint y tipos de todo | `pnpm lint && pnpm type-check` |
| Tests del backend | `cd backend && poetry run pytest` |
| Nueva migración | `cd backend && poetry run alembic revision --autogenerate -m "..."`, revisar el archivo, y después `poetry run alembic check` |
| Regenerar el contrato (después de cambiar la API) | `pnpm --filter @clubsystem/api generate` |

La CI (`.github/workflows/ci.yml`) corre en cada PR:
- backend: ruff, pyright, migraciones + `alembic check`, tests contra Postgres real con RLS, verificación de que el contrato OpenAPI commiteado esté al día y `pip-audit`;
- frontends: lint, type-check, build y `pnpm audit`.

## Arquitectura en una línea por capa

- **Tenant**: el club activo sale de la sesión (panel) o de la URL validada contra la membresía (app). Toda consulta filtra por club, y Postgres lo refuerza con Row-Level Security (`FORCE`, rol de app sin privilegios).
- **Auth**: access token de 15 minutos y refresh rotativo con detección de reuso. Los roles se leen de la base en cada request.
- **Backend**: routers delgados → services (una transacción por request) → `get_scoped`/queries con `club_id`. Las reglas puras viven en `domain/`.
- **Frontends**: `app/` contiene solo rutas. Cada dominio vive en `features/<dominio>/`. Los datos se obtienen con TanStack Query a través del cliente generado.
