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

`pnpm audit` ignora dos advisories altos sin parche publicado (`pnpm.auditConfig.ignoreCves` en el `package.json` raíz). Los dos llegan solo por el tooling de Expo (`@expo/cli`) y no forman parte del bundle de la app ni de la web:
- `CVE-2026-93687` (braces ≤3.0.3, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)): DoS por patrones anidados, vía metro → micromatch.
- `CVE-2026-85393` (node-forge ≤1.4.0, [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)): verificación de firmas PKCS#1 v1.5, vía el code signing del CLI.

Cuando Expo publique versiones que los resuelvan, actualizá y sacá esas entradas.

## Arquitectura en una línea por capa

- **Tenant**: el club activo sale de la sesión (panel) o de la URL validada contra la membresía (app). Toda consulta filtra por club, y Postgres lo refuerza con Row-Level Security (`FORCE`, rol de app sin privilegios).
- **Auth**: access token de 15 minutos y refresh rotativo con detección de reuso. Los roles se leen de la base en cada request.
- **Backend**: routers delgados → services (una transacción por request) → `get_scoped`/queries con `club_id`. Las reglas puras viven en `domain/`.
- **Frontends**: `app/` contiene solo rutas. Cada dominio vive en `features/<dominio>/`. Los datos se obtienen con TanStack Query a través del cliente generado.

## Emails con Resend

Los emails transaccionales (verificación, reset de contraseña e invitaciones) salen por la API HTTP de [Resend](https://resend.com). Se configuran en `backend/.env` o en las variables del servicio:

| Variable | Valor |
|---|---|
| `EMAIL_BACKEND` | `resend` en producción. En desarrollo, `console` (loguea el email, links incluidos) o `disabled` |
| `RESEND_API_KEY` | Clave de la API (`re_…`). Es un secreto: nunca va al repo |
| `EMAIL_FROM` | Remitente de un dominio verificado, por ejemplo `ClubSystem <no-reply@mail.tudominio.com>` |
| `EMAIL_TIMEOUT_SECONDS` | Timeout de cada envío (10 por defecto) |

El envío no bloquea el request. Si Resend falla, la respuesta HTTP no cambia (tampoco revela si un email está registrado) y el backend loguea `No se pudo enviar un email: …` con el motivo, sin destinatario ni contenido. El `request_id` del log identifica el request que lo originó.

### Verificar el dominio

Resend solo envía desde dominios verificados. Sin verificar, cada envío falla con `Resend respondió 403 (validation_error)` en el log.

1. En Resend, **Domains → Add Domain**. Conviene usar un subdominio dedicado (por ejemplo `mail.tudominio.com`) para no comprometer la reputación del dominio principal.
2. Resend muestra los registros DNS a crear: SPF (TXT) y MX para el envío, y DKIM (TXT). Cargalos tal cual en el proveedor de DNS.
3. Recomendado: un registro DMARC (`_dmarc`, TXT), aunque sea con `p=none` al principio.
4. Volvé a Resend y tocá **Verify**. La propagación puede tardar de minutos a algunas horas; el dominio tiene que quedar en estado *Verified*.
5. En **API Keys**, creá una clave con permiso *Sending access* limitada a ese dominio, y cargala como `RESEND_API_KEY`.
6. Configurá `EMAIL_FROM` con una dirección de ese dominio.
7. Probá el circuito pidiendo "olvidé mi contraseña" para una cuenta propia y revisá el log y el panel de Resend (**Emails**).

## Antes de producción

Estas tareas no se pueden resolver con código del repo y quedan pendientes:

- **Email.** En producción la app solo arranca con `EMAIL_BACKEND=resend`, `RESEND_API_KEY` y `EMAIL_FROM`, y el dominio del remitente tiene que estar verificado en Resend (ver [Emails con Resend](#emails-con-resend)). Verificación de email, reset de contraseña e invitaciones dependen de eso.
- **Proxy y rate limiting.** El límite de intentos es por IP y en memoria del proceso.
  - Detrás de un proxy, Next o un balanceador, levantá uvicorn con `--proxy-headers --forwarded-allow-ips=<IP del proxy>`. Si no, todas las requests comparten una sola IP.
  - Con varias réplicas, configurá un storage compartido (Redis) en `app/api/rate_limit.py`.
- **Roles de base de datos.** Creá dos roles:
  - uno dueño del esquema, con `BYPASSRLS`, que ejecuta las migraciones y los scripts;
  - uno para la app, sin ownership y sin `BYPASSRLS`, al que las migraciones le dan permisos (`DB_APP_ROLE`).

  Las migraciones se corren como paso aparte del deploy, nunca al arrancar la app.
- **Secretos.** Configurá `JWT_SECRET_KEY` (32 caracteres o más, aleatorio) y `ANTHROPIC_API_KEY`, esta última si se usan las explicaciones de anomalías. Verificá `CORS_ORIGINS` y `COOKIE_SECURE=true`.
