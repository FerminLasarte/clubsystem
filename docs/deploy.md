# Deploy a producción

| Pieza | Dónde | Dominio (ejemplo) |
|---|---|---|
| Panel (Next.js) | Vercel, región `iad1` | `app.tudominio.com` |
| API (FastAPI) | Railway, plan Hobby, US East (Virginia), Docker | `api.tudominio.com` |
| Postgres | Supabase, East US (N. Virginia), **solo como Postgres** | — |
| Email | Resend | `mail.tudominio.com` |
| Errores y latencia | Sentry, región US | — |

Lo que está automatizado en el repo:
- `backend/railway.json`: build, pre-deploy, health check, reinicios y región de la API.
- `backend/Dockerfile`: imagen de la API.
- `backend/scripts/provision_db.py`: roles de base.
- `backend/scripts/predeploy.sh`: migraciones y chequeo de la base.
- `backend/scripts/check_db.py`: roles, RLS y permisos.
- `backend/scripts/create_club.py`: alta de un club con la invitación a su dueño.
- `apps/web/vercel.json`: región y build solo si cambió la web.

El navegador habla solo con `app.`. El proxy de Next (`apps/web/proxy.ts`) reenvía `/api/*` a `api.`, así que las cookies de sesión son de primera parte. La app mobile llama directo a `api.`.

## 0. Antes de empezar

- Un dominio propio (en la guía, `tudominio.com`) y acceso a su DNS.
- Cuentas en Supabase, Resend, Railway, Vercel y Sentry. En todas se puede entrar con GitHub.
- Dos secretos aleatorios, uno para `JWT_SECRET_KEY` y otro para `PROXY_SHARED_SECRET`. Generá cada uno con este comando:

  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

  `PROXY_SHARED_SECRET` lleva el mismo valor en Railway y en Vercel.

## 1. Supabase

1. **New project** en la región **East US (North Virginia)**, la misma que Railway. Para producción conviene el plan Pro: tiene backups diarios y el proyecto no se pausa. Guardá la contraseña de la base en tu gestor de contraseñas.
2. **Project Settings → Data API**: desactivala. No usamos `supabase-js` ni PostgREST, y así ningún endpoint público expone el esquema `public`.
3. **Database → Settings**: activá **Enforce SSL**.
4. **Connect → Session pooler**: copiá la URI. Es la del puerto **5432**; no uses la del 6543, que es modo transacción y rompe las prepared statements de asyncpg.
5. Creá los roles desde tu máquina:

   ```bash
   cd backend && ADMIN_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' poetry run python scripts/provision_db.py --env-file .env.production
   ```

   Crea `clubsystem_owner` (dueño, `BYPASSRLS`, para migraciones) y `clubsystem_app` (sin privilegios, sujeto a RLS). También instala `btree_gist` y escribe `DATABASE_URL` y `MIGRATIONS_DATABASE_URL` en `backend/.env.production` (git lo ignora). Las contraseñas no se imprimen.

6. Mientras la base esté vacía (antes del primer deploy), corré una vez los tests contra este proyecto con las URLs de `.env.production`, como en [Probar contra Supabase local](#probar-contra-supabase-local) pero sin `--ssl disable`. Ya se probó contra la imagen local de Supabase; esto confirma la red y el SSL reales. **Nunca los corras con datos:** vacían las tablas.

En Hobby, Railway no tiene IPs de salida fijas, así que no se pueden usar las *Network restrictions* de Supabase. La base queda protegida por las contraseñas largas de los roles y por SSL.

## 2. Resend

Seguí [Verificar el dominio](../README.md#verificar-el-dominio) en el README. Al final tenés `RESEND_API_KEY` (con permiso *Sending access* solo para ese dominio) y `EMAIL_FROM`, por ejemplo `ClubSystem <no-reply@mail.tudominio.com>`.

## 3. Railway (API)

1. **New Project → Deploy from GitHub repo**: elegí este repo. Railway crea un servicio; renombralo `api`.
2. En **Settings** del servicio:
   - **Root Directory**: `/backend`.
   - **Config file path** (*Config-as-code*): `/backend/railway.json`. Railway no lo busca dentro del Root Directory, por eso va la ruta completa.
   - **Wait for CI**: activado. Así solo despliega los commits de `main` con la CI en verde.
   - **Branch**: `main`.

   `railway.json` ya fija el resto: build con el `Dockerfile`, migraciones antes de cada deploy, health check en `/health`, reinicio si se cae, 15 s para terminar envíos pendientes al apagar, una réplica en Virginia, y deploy solo si cambió `backend/`.
3. En **Variables → Raw Editor** pegá esto, con tus valores:

   ```dotenv
   ENV=production
   LOG_JSON=true
   PORT=8000
   DATABASE_URL=<de backend/.env.production>
   MIGRATIONS_DATABASE_URL=<de backend/.env.production>
   DB_APP_ROLE=clubsystem_app
   DB_POOL_SIZE=5
   DB_MAX_OVERFLOW=5
   JWT_SECRET_KEY=<secreto del paso 0>
   PROXY_SHARED_SECRET=<secreto del paso 0>
   TRUSTED_IP_HEADER=x-real-ip
   COOKIE_SECURE=true
   PUBLIC_WEB_URL=https://app.tudominio.com
   EMAIL_BACKEND=resend
   RESEND_API_KEY=<de Resend>
   EMAIL_FROM="ClubSystem <no-reply@mail.tudominio.com>"
   ANTHROPIC_API_KEY=<opcional: solo para las explicaciones de anomalías>
   SENTRY_DSN=<DSN del proyecto clubsystem-api, ver paso 6>
   ```

   Qué significa cada una:
   - **`DB_POOL_SIZE` y `DB_MAX_OVERFLOW`:** limitan la API a 10 conexiones, porque en modo sesión cada una ocupa una conexión del pooler de Supabase.
   - **`TRUSTED_IP_HEADER`:** el edge de Railway siempre sobrescribe `X-Real-IP` con la IP real. `X-Forwarded-For` no sirve, porque Railway conserva lo que manda el cliente.
   - **`COOKIE_DOMAIN` y `CORS_ORIGINS`:** quedan sin definir a propósito. La cookie es del host de la web (la setea la respuesta que pasa por el proxy de Vercel) y ningún navegador llama a la API desde otro origen.
4. **Deploy.** Railway construye la imagen y corre `scripts/predeploy.sh` (`alembic upgrade head` y `check_db.py`) con el rol dueño. Recién después levanta la API. Si el pre-deploy falla, no se publica nada y sigue la versión anterior.
5. **Settings → Networking → Custom Domain**: agregá `api.tudominio.com` con el puerto 8000 y creá en tu DNS los registros que te indica Railway.
6. **Workspace → Usage**: poné un límite de gasto. Hobby cobra por uso por encima de los USD 5 incluidos.
7. Verificá:

   ```bash
   curl -s https://api.tudominio.com/health
   ```

   Y que el rate limit no se pueda esquivar falsificando headers. Son 11 logins fallidos, cada uno con una IP inventada distinta y un email distinto (con el mismo email cortaría el límite por email, que no depende de la IP, y la prueba no diría nada):

   ```bash
   for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " -H "X-Real-IP: 203.0.113.$i" -H "X-Forwarded-For: 203.0.113.$i" -H 'content-type: application/json' -d "{\"email\":\"nadie$i@example.com\",\"password\":\"xxxxxxxxxx\"}" https://api.tudominio.com/api/v1/auth/mobile/login; done
   ```

   El último tiene que dar `429`; los anteriores, `401`. Si nunca aparece el 429, la API está tomando la IP de los headers falsos y hay que revisar `TRUSTED_IP_HEADER` antes de seguir. Tu IP queda bloqueada para ese endpoint durante un minuto.

### Rate limit con varias instancias

Con una sola instancia los contadores en memoria alcanzan. Para escalar:
1. **New → Database → Redis** en el mismo proyecto.
2. En la API, agregá `RATE_LIMIT_STORAGE_URI=${{Redis.REDIS_URL}}`, que usa la red privada.
3. Subí `numReplicas` en `railway.json`.

Los jobs del scheduler son idempotentes, así que pueden correr en todas las réplicas.

## 4. Vercel (panel)

1. **Add New → Project** e importá el repo.
   - **Root Directory**: `apps/web`.
   - **Framework**: Next.js (lo detecta solo, igual que pnpm y el workspace).
   - **Node.js**: 22.
2. **Environment Variables**, entorno *Production*:
   - `BACKEND_URL` = `https://api.tudominio.com`
   - `PROXY_SHARED_SECRET` = el del paso 0
   - Las de Sentry del [paso 6](#6-monitoreo-de-errores-y-latencia-sentry).
3. Previews: no hay API de staging. Dejá activa la **Deployment Protection** (Vercel Authentication), que viene por defecto. Si querés previews funcionales, cargá las mismas dos variables también en *Preview*; van a usar la API de producción.
4. **Settings → Domains**: agregá `app.tudominio.com` y el registro DNS que indica Vercel.
5. `vercel.json` fija la región `iad1` (Virginia, cerca de la API) y saltea el build cuando un commit no toca la web ni sus paquetes (`turbo-ignore`).
6. El plan Hobby de Vercel no admite uso comercial. Para cobrarles a clubes corresponde Pro.

## 5. App mobile

Los builds de release tienen que usar `EXPO_PUBLIC_API_URL=https://api.tudominio.com` y las variables de Sentry del [paso 6](#6-monitoreo-de-errores-y-latencia-sentry). La configuración de EAS no está en esta guía.

## 6. Monitoreo de errores y latencia (Sentry)

Las tres apps reportan a Sentry los errores inesperados y una muestra de los tiempos de respuesta. **Sin DSN no se inicializa nada**: desarrollo, CI y e2e corren sin Sentry. El código está en `backend/app/core/monitoring.py`, `apps/web/lib/monitoring.ts`, `apps/mobile/shared/lib/monitoring.ts` y el filtro compartido `packages/shared/src/monitoring.ts`.

**Plan.** El Developer, gratis, alcanza para empezar: 5.000 errores por mes, un solo usuario y 30 días de historial. Cuando se acaba la cuota, Sentry descarta los eventos hasta fin de mes y te quedás sin monitoreo, por eso conviene el límite del punto 3. Pasá a Team (USD 26/mes: 50.000 errores y usuarios ilimitados) cuando entre una segunda persona o la cuota quede corta.

1. **Organización.** Creala en [sentry.io](https://sentry.io) con la región de datos **US**, la misma de Railway y Supabase. No se puede cambiar después.
2. **Proyectos.** Creá tres, cada uno con su DSN:
   - `clubsystem-api` (FastAPI)
   - `clubsystem-web` (Next.js)
   - `clubsystem-mobile` (React Native)

   No hace falta seguir el asistente de instalación: el código ya está en el repo.
3. **Límites y privacidad.** En cada proyecto, en **Settings → Client Keys (DSN) → Rate Limiting**, poné unos 100 eventos por hora, para que un error en loop no se coma la cuota del mes. En **Organization Settings → Security & Privacy**, dejá activos *Data Scrubber* y *Use Default Scrubbers*, y activá *Prevent Storing of IP Addresses*. Es una segunda capa sobre el filtro del código.
4. **Auth token** para subir los source maps: en **Settings → Auth Tokens** creá un *Organization Token*. Es un secreto: va solo en Vercel y en EAS, nunca en el repo.
5. **Railway (API).** Cargá `SENTRY_DSN` con el DSN de `clubsystem-api`. Opcionalmente, `SENTRY_TRACES_SAMPLE_RATE` (por defecto `0.1`, el 10% de los requests). La versión sale sola de `RAILWAY_GIT_COMMIT_SHA`, así que cada error queda asociado a su commit.
6. **Vercel (panel)**, entorno *Production*:
   - `NEXT_PUBLIC_SENTRY_DSN`: el DSN de `clubsystem-web`. Se incrusta en el build, así que cambiarlo requiere redeployar.
   - `SENTRY_ORG` y `SENTRY_PROJECT` (`clubsystem-web`).
   - `SENTRY_AUTH_TOKEN`: el del punto 4, marcado como *Sensitive*.
   - Opcional: `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (por defecto `0.1`).

   El entorno (`production` o `preview`) sale de `NEXT_PUBLIC_VERCEL_ENV`, que Vercel define solo. El navegador manda los eventos a `/monitoring` del mismo origen y Next los reenvía a Sentry: la CSP no cambia y los bloqueadores de publicidad no los cortan.
7. **App mobile (EAS)**, en los builds de release:
   - `EXPO_PUBLIC_SENTRY_DSN`: el DSN de `clubsystem-mobile`.
   - `SENTRY_ORG` y `SENTRY_PROJECT` (`clubsystem-mobile`).
   - `SENTRY_AUTH_TOKEN`, como secreto.

   **Sin el token, el build de release falla** al querer subir los source maps. En builds locales o de prueba, definí `SENTRY_DISABLE_AUTO_UPLOAD=true`, como hace `apps/mobile/e2e/run-ios.sh`. El muestreo de la app está fijo en 10%: cambiarlo requiere un build nuevo de todos modos.

**Qué se manda y qué no.**
- Se manda: el error con su stack trace, la ruta, el método, el status, el navegador o dispositivo, la versión, y los tags `request_id`, `user_id` y `club_id`. Los dos últimos son UUIDs.
- No se manda nunca: cuerpos de requests, cookies, headers de autenticación, query strings, variables locales del stack ni la IP.
- Además, un filtro con las mismas reglas en el backend y en los clientes reemplaza por `[Filtered]` emails, DNI, JWT y tokens que aparezcan en cualquier texto, por ejemplo en el `DETAIL` de un error de Postgres o en la URL `/reset-password?token=…`. Lo cubre `backend/tests/test_monitoring.py`.
- No se usa Session Replay ni capturas de pantalla.
- Los 4xx y los cortes de red del usuario no se reportan: son respuestas esperadas.

**Del error al log.**
- **Errores del backend.** Cada evento lleva el tag `request_id`, el mismo de los logs de Railway y del cuerpo de los 500. Buscalo en **Railway → Logs** para ver el request completo.
- **Errores del panel y la app.** Un 5xx que ve el panel o la app se reporta con el `request_id` que devolvió el backend, así que el error del cliente y el del servidor se encuentran con el mismo valor.
- **Trazas.** El panel y la app propagan la traza a la API (headers `sentry-trace` y `baggage`), y en **Explore → Traces** se ve el recorrido completo con sus tiempos. La API sigue la decisión de muestreo del cliente, para que la traza quede entera.

**Probarlo en local.** Poné el DSN en `backend/.env` (`SENTRY_DSN`), en `apps/web/.env.local` (`NEXT_PUBLIC_SENTRY_DSN`) o en `apps/mobile/.env.local` (`EXPO_PUBLIC_SENTRY_DSN`). Los eventos salen con el entorno `development`.

## 7. Primer club

El panel no crea clubes; los da de alta un operador desde una shell dentro del servicio, que tiene todo el entorno de producción. Con la [CLI de Railway](https://docs.railway.com/guides/cli):

```bash
brew install railway
```

```bash
railway login && railway link
```

```bash
railway ssh
```

`railway link` te pide elegir el proyecto y el servicio `api`. `railway ssh` abre la shell. Ya adentro, corré:

```bash
python scripts/create_club.py --slug los-cardos --name "Los Cardos" --owner-email duena@example.com --sport padel --sport tennis --city Rosario
```

- `--slug`: minúsculas, números y guiones.
- `--sport`: se repite por cada deporte (`tennis`, `padel`, `football`…).
- `--timezone`: opcional; por defecto `America/Argentina/Buenos_Aires`.

El script crea el club y le manda al dueño una invitación por email, que vence en 7 días. Al aceptarla, el dueño elige su contraseña (o usa la de su cuenta si ya tenía) y entra al panel como OWNER. Desde ahí invita al resto del equipo.

Si la invitación vence, se vuelve a correr el mismo comando: con el slug existente solo se renueva la invitación.

## 8. Comprobación final

- [ ] El dueño del primer club acepta la invitación y entra al panel.
- [ ] Login en `https://app.tudominio.com`. En las DevTools, las cookies `cs_access` y `cs_refresh` aparecen `HttpOnly` y `Secure`, del host `app.`.
- [ ] "Olvidé mi contraseña" con una cuenta propia: el email llega y el link abre `app.`.
- [ ] Login desde la app mobile contra `api.`.
- [ ] Varios logins fallidos seguidos desde el panel terminan en 429. Desde otra red (por ejemplo, datos del celular) se puede seguir intentando.
- [ ] En los logs de Railway, cada request tiene `request_id` y no hay emails, DNI ni tokens.
- [ ] En Sentry → Explore → Traces aparecen transacciones de la API y del panel. Abrí una de `POST /api/v1/auth/web/login`: tiene el tag `request_id` y no tiene el email, el cuerpo, las cookies ni la IP.

## Probar contra Supabase local

La CLI de Supabase levanta con Docker la misma imagen de Postgres que sus proyectos, con los mismos roles, restricciones y pooler. Sirve para probar roles, migraciones y RLS sin crear un proyecto.

1. En una carpeta fuera del repo, corré `npx supabase init`.
2. En `supabase/config.toml`, dentro de `[db.pooler]`, poné `enabled = true` y `pool_mode = "session"`. Si ya tenés otro proyecto local corriendo, cambiá también `project_id` y los puertos.
3. Levantá solo la base y el pooler:

   ```bash
   npx supabase start -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector
   ```

4. Desde `backend/`, con el puerto del pooler (54329 por defecto). La base local no tiene SSL, por eso `--ssl disable`:

   ```bash
   ADMIN_DATABASE_URL='postgresql://postgres.pooler-dev:postgres@127.0.0.1:54329/postgres' poetry run python scripts/provision_db.py --ssl disable --env-file .env.supabase-local
   ```

5. Con esas URLs como `DATABASE_URL`/`MIGRATIONS_DATABASE_URL` y también como `TEST_DATABASE_URL`/`TEST_MIGRATIONS_DATABASE_URL`, corré:

   ```bash
   poetry run alembic upgrade head && poetry run python scripts/check_db.py && poetry run pytest
   ```

## Rotar credenciales

- **Base**: corré `provision_db.py --rotate --env-file .env.production`, actualizá las dos URLs en Railway y redeployá.
- **`PROXY_SHARED_SECRET`**: cambialo en Vercel y en Railway juntos. Mientras no coincidan, el panel vuelve a compartir la IP de Vercel en el rate limit; no deja de funcionar.
- **`JWT_SECRET_KEY`**: cambiarlo cierra todas las sesiones.
