# ClubSystem

SaaS multi-tenant para clubes deportivos. Monorepo pnpm + Turborepo.
- `backend/`: FastAPI + SQLAlchemy async + PostgreSQL (Poetry). Panel (`/api/v1/admin/*`), app del socio (`/api/v1/mobile/*`) y auth (`/api/v1/auth/*`).
- `apps/web/`: Next.js (App Router) + Tailwind v4 + shadcn. Es el panel del staff.
- `apps/mobile/`: Expo + Expo Router. Es la app del socio.
- `packages/types/`: tipos GENERADOS desde el OpenAPI del backend. No se editan a mano.

La auditoría y el roadmap están en `docs/audit/AUDIT.md`. Las decisiones tomadas están en su Anexo C.

## Comandos (backend)
- DB local: `cd backend && docker compose up -d db` (Postgres 17 con los roles `clubsystem_owner` y `clubsystem_app`).
- Migraciones: `poetry run alembic upgrade head`. Para cambios: `poetry run alembic revision --autogenerate -m "..."`, revisar el archivo y después `poetry run alembic check`.
- API: `poetry run uvicorn app.main:app --reload`.
- Tests: `poetry run pytest` (usa `TEST_DATABASE_URL` / `TEST_MIGRATIONS_DATABASE_URL`).
- Calidad: `poetry run ruff format . && poetry run ruff check . && poetry run pyright`.

Antes de dar una tarea por terminada, corré los tests y linters del área que tocaste y decí el resultado. Si no los pudiste correr, decilo.

## Multi-tenancy y permisos (no negociable)
- El club sale SIEMPRE del contexto: `StaffContext` (panel, club activo de la sesión) o `MemberContext` (app, `club_id` en la URL, socio APPROVED). Nunca se confía en un `club_id` que mande el cliente en el body.
- Todo id que mande el cliente (court, membership, payment, item…) se resuelve con `get_scoped(session, Model, id, ctx.club_id)` o con una query filtrada por `club_id`. Nunca `session.get(Model, id)` sobre una entidad de club.
- Los endpoints del panel exigen permisos (`require(Permission.X)`, ver `app/domain/permissions.py`), no roles. Los roles se leen de `club_staff` en cada request.
- RLS (FORCE) está activa en todas las tablas con `club_id`. Es la red de seguridad, no reemplaza el filtro explícito.
- `users` es identidad global: un club no edita ni desactiva un `User`. Lo propio de cada club (plan, número de socio, estado) vive en `ClubMembership`.
- Nunca devolver secretos ni hashes, y nunca loguear DNI, emails ni tokens.
- Cada endpoint nuevo necesita tests de permisos y de aislación: un usuario del club A no ve ni modifica datos del club B.

## Backend: capas y reglas
- `api/v1/{admin,mobile}/*.py`: routers delgados. Parsean, llaman al service y devuelven el schema. Sin queries ni commits.
- `services/*.py`: casos de uso. Reciben `(session, ctx)`.
- `domain/`: enums, permisos y reglas puras (por ejemplo precios y turnos).
- `schemas/*.py`: DTOs Pydantic.
- `repositories/base.py`: `get_scoped` y `paginate`.
- Una transacción por request (`get_session`). Nadie hace `commit`/`rollback`; los services usan `flush()` cuando necesitan ids o quieren que una constraint falle en ese momento.
- Errores: lanzar `app.core.errors` (`NotFound`, `Conflict`, `Forbidden`, `BusinessRuleViolation`…). `api/errors.py` los traduce. Las violaciones de constraints conocidas se mapean en `_CONSTRAINT_ERRORS`. No escribir `except Exception`.
- Si algo tiene que persistir aunque el request falle (por ejemplo revocar sesiones), va en una transacción aparte (`session_scope()`).
- Dinero en `Decimal` (`Money`/`PositiveMoney` en schemas, `Numeric` en la base). Nunca `float`.
- Fechas: `timestamptz` en UTC. "Hoy" y los rangos de un día o un mes se calculan con `app.core.time` y `club.timezone`, y se filtran como `>= inicio AND < fin`. Nunca `date.today()`, `datetime.utcnow()` ni `func.date()` en filtros. Los datetimes de entrada son `AwareDatetime`.
- Listados con `Page[T]` (`page`, `page_size` ≤ 200, `total`).
- Exportaciones CSV con `app.core.csv.csv_response` (neutraliza fórmulas).
- Cambios de esquema SOLO con Alembic. Los enums se guardan como VARCHAR + CHECK (`str_enum`).
- Nada bloqueante en `async def`: bcrypt vía threadpool, SDKs en su versión async, el LLM fuera del request.
- Logging: `logger = logging.getLogger(__name__)`, sin `print`. El contexto (request_id, club) se agrega solo.

## Frontends
- `app/` contiene solo rutas finas; la lógica va en `features/<dominio>/{api,hooks,components}`.
- Datos remotos con TanStack Query (nada de `useEffect` + `fetch`). HTTP solo a través del cliente compartido.
- Tipos de la API desde `@clubsystem/types`. Prohibido `any` y `as unknown as`.
- Web: componentes de `components/ui` (shadcn: `Button`, `Dialog`, `Input`, `Label`, `DropdownMenu`). Colores solo con tokens semánticos de `@theme` en `app/globals.css`.
- Mobile: estilos solo desde `shared/theme/tokens.ts`.
- Las reglas de negocio (precios, disponibilidad, permisos) se calculan en el backend; los clientes solo muestran.
- Errores: nunca tragarlos. El estado de error se muestra distinto del estado vacío.

## Forma de trabajar
- Cambios mínimos y enfocados, con diffs chicos.
- No duplicar lógica: antes de escribir, buscar si ya existe en `domain/`, `repositories/`, `services/` o `packages/`.
- Lo que esté fuera del alcance se menciona, no se arregla de paso.
- Ante una ambigüedad de producto (precios, estados, permisos), preguntar antes de implementar.
