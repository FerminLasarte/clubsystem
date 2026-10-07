# Tests e2e de humo

Dos recorridos cortos que prueban que las piezas funcionan juntas: navegador o simulador, frontend,
API real y Postgres con RLS. No reemplazan a los tests de API (`backend/tests`), que cubren reglas,
permisos y aislación. Solo verifican que el camino feliz de punta a punta no esté roto.

| | Panel web | App del socio |
|---|---|---|
| Herramienta | [Playwright](https://playwright.dev) | [Maestro](https://maestro.mobile.dev) |
| Recorrido | login → crear reserva → confirmar la pendiente de la app → cobrar cuota → ver la caja | login con email → reservar → verla en Mis reservas → cancelarla |
| Código | `apps/web/e2e/`, `apps/web/playwright.config.ts` | `apps/mobile/.maestro/`, `apps/mobile/e2e/run-ios.sh` |
| CI | Job `e2e-web` de `ci.yml`, en cada PR (~4 min) | `e2e-mobile.yml`: manual o cada noche (~30–40 min) |

## Datos y base

Los dos usan la base de **test** (`TEST_DATABASE_URL` / `TEST_MIGRATIONS_DATABASE_URL`, la misma
que pytest) y `backend/scripts/e2e.py`:

- `seed` aplica las migraciones, vacía la base y carga un club con una dueña (panel), una socia
  aprobada (app), dos canchas, una reserva pendiente de la app para mañana y la cuota del mes.
  Corre antes de cada ejecución, así que se puede repetir sin limpiar nada a mano.
- `serve --port 8001` levanta la API contra esa base, con emails a consola y sin límite de login.

Las cuentas y la contraseña están en `backend/scripts/e2e_fixtures.json`. Playwright y Maestro las
leen de ahí. El script se niega a tocar una base cuyo nombre no termine en `_test`. Como pytest
vacía la misma base, no corras los e2e y pytest al mismo tiempo.

## Panel web (Playwright)

Requisitos: la base de test creada (`docker compose up -d db` o tu Postgres local con
`docker/init-db.sql`), el venv del backend (`backend/.venv`) y el navegador de Playwright, que se
instala una sola vez:

```bash
pnpm --filter web exec playwright install chromium
```

Correrlo:

```bash
pnpm --filter web test:e2e
```

Hace `next build`, siembra la base y levanta la API (puerto 8001) y `next start` (puerto 3001).
No choca con `next dev` (3000) ni con la API de desarrollo (8000). Otras opciones:

- `pnpm --filter web exec playwright test --ui` (o `--headed`) para verlo paso a paso.
  Sin `next build` antes, usa el último build.
- Si una corrida falla, en `apps/web/test-results/` queda el trace:
  `pnpm --filter web exec playwright show-trace <archivo>.zip`.
- `E2E_PYTHON=/ruta/a/python` si el venv del backend no está en `backend/.venv`.

En la CI, si el job falla, el reporte HTML y los traces quedan como artefacto `playwright-report`.

### Accesibilidad (axe)

`apps/web/e2e/a11y.spec.ts` corre [axe](https://github.com/dequelabs/axe-core) (WCAG 2.2 A/AA y
buenas prácticas) sobre login, inicio, reservas, socios, caja, cuotas, stock, gastos y ajustes, sus
pestañas y los diálogos principales, y falla ante cualquier violación. Es el proyecto `a11y` de
Playwright, que depende de `smoke` (`panel.spec.ts`): corre después para ver los estados que deja el
smoke (reservas confirmadas, cuota pagada, ingreso en caja). Un fallo lista la regla, el selector y
el motivo (por ejemplo el contraste medido). El lint suma las reglas recomendadas de
`eslint-plugin-jsx-a11y`.

## App del socio (Maestro, simulador de iOS)

Requisitos (macOS):

- Xcode con un runtime de iOS y CocoaPods.
- Java 17 o más nuevo.
- Maestro: `brew install mobile-dev-inc/tap/maestro`.
- La base de test y `backend/.venv`, igual que para Playwright.

Correrlo:

```bash
apps/mobile/e2e/run-ios.sh
```

El script hace lo siguiente:
1. Compila la app en Release para el simulador, con la API en `http://localhost:8001` fija en el
   build. Solo lo hace la primera vez (15–20 min) o con `E2E_REBUILD=1`. Corré con
   `E2E_REBUILD=1` después de cambiar la app, porque si no se prueba el build anterior.
2. Usa un simulador propio, **"ClubSystem E2E"**, y lo crea si no existe. Así no toca tus
   simuladores ni la sesión que tengas en la app.
3. Siembra la base, levanta la API y corre los flows de `apps/mobile/.maestro/`.

Si un paso falla, las capturas quedan en `apps/mobile/e2e/output/` y el log de la API en
`apps/mobile/e2e/api.log`. Para ajustar un flow sirven `maestro studio` (inspector visual) y
`maestro hierarchy` (árbol de accesibilidad de la pantalla actual).

Espacio que ocupa: Maestro ~360 MB (+ OpenJDK de Homebrew), `apps/mobile/ios` y el build ~2–4 GB,
y el simulador ~1 GB. Para borrarlo:

```bash
brew uninstall maestro
```
```bash
rm -rf apps/mobile/ios
```
```bash
xcrun simctl delete "ClubSystem E2E"
```

### Versiones de Xcode e iOS

La app adopta el ciclo de vida por escenas (UIScene) con `apps/mobile/plugins/withSceneLifecycle.js`
hasta Expo SDK 58. Sin eso, compilada con el SDK de iOS 27 se cierra al abrir. Con el plugin
abre en iOS 26 y en iOS 27.

| Dónde | Xcode | Simulador de los e2e |
|---|---|---|
| Mac de desarrollo | 27 | iOS 27, en "ClubSystem E2E" |
| CI (`e2e-mobile.yml`) | 26, fijado con `xcode-version: "26"` | El iOS 26.x que trae ese Xcode |

La CI sigue en Xcode 26 porque el runner `macos-26` no trae Xcode 27. Solo lo tiene la imagen
`xcode-27`, que hoy está en preview
([actions/runner-images#14404](https://github.com/actions/runner-images/issues/14404)). Cuando
salga de preview: `runs-on: xcode-27` y se saca el paso `setup-xcode`.

### En GitHub Actions

`.github/workflows/e2e-mobile.yml` corre el mismo script en un runner `macos-26` con Xcode 26.
Instala Postgres con Homebrew porque esos runners no tienen Docker. Se lanza de dos formas:
- A mano, desde Actions → "E2E mobile (Maestro)" → Run workflow.
- Solo, cada noche a las 03:00 de Argentina.

Si falla, las capturas y el log de la API quedan como artefacto `maestro-output`.

Por qué así (decidido el 2026-10-06):
- **Mientras el repo sea público, los runners de GitHub, macOS incluido, no tienen costo.** Si
  pasa a privado, cada corrida cuesta ~US$ 2 (~35 min a US$ 0,062/min). Corriendo cada noche son
  ~US$ 65 por mes. En ese caso conviene dejar solo la ejecución manual.
- **Va en un workflow aparte y no en cada PR**, porque el build de Xcode tarda mucho.
- **iOS y no Android**: es la plataforma con la que se desarrolla localmente, y el emulador de
  Android en la CI es menos estable.
- **No usa Maestro Cloud** (US$ 250 por dispositivo por mes) **ni EAS Workflows** (plan pago):
  los dos necesitan una API pública con base de test, y hoy no hay un entorno de staging.
