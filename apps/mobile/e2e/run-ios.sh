#!/usr/bin/env bash
# E2E de humo de la app con Maestro en un simulador de iOS (ver docs/e2e.md).
#
#   apps/mobile/e2e/run-ios.sh            # compila si hace falta, siembra la base, levanta la API y corre los flows
#   E2E_REBUILD=1 apps/mobile/e2e/run-ios.sh   # fuerza el prebuild y la compilación (después de cambiar la app)
#   E2E_IOS_RUNTIME=26 apps/mobile/e2e/run-ios.sh   # simulador con iOS 26.x en vez del runtime más nuevo
#
# Usa un simulador propio ("ClubSystem E2E", lo crea si no existe) para no tocar los de desarrollo,
# la base de test (backend/scripts/e2e.py) y la API en el puerto 8001.
set -euo pipefail

MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$(cd "$MOBILE/../../backend" && pwd)"
PYTHON="${E2E_PYTHON:-$BACKEND/.venv/bin/python}"
API_PORT=8001
IOS_RUNTIME="${E2E_IOS_RUNTIME:-}"
SIMULATOR="${E2E_SIMULATOR:-ClubSystem E2E${IOS_RUNTIME:+ (iOS $IOS_RUNTIME)}}"
DERIVED="$MOBILE/ios/build/e2e"
APP="$DERIVED/Build/Products/Release-iphonesimulator/ClubSystem.app"
OUTPUT="${E2E_OUTPUT_DIR:-$MOBILE/e2e/output}"

export MAESTRO_CLI_NO_ANALYTICS=1
# CocoaPods falla con un locale que no sea UTF-8.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

step() { printf '\n==> %s\n' "$*"; }

if [[ ! -d "$APP" || -n "${E2E_REBUILD:-}" ]]; then
  step "Compilando la app (Release, simulador) contra http://localhost:$API_PORT"
  cd "$MOBILE"
  CI=1 npx expo prebuild --platform ios
  # La URL de la API queda fija en el build (app.config.ts → extra.apiUrl).
  EXPO_PUBLIC_API_URL="http://localhost:$API_PORT" xcodebuild \
    -workspace ios/ClubSystem.xcworkspace -scheme ClubSystem -configuration Release \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DERIVED" CODE_SIGNING_ALLOWED=NO -quiet build
fi

step "Simulador \"$SIMULATOR\""
udid="$(xcrun simctl list devices available -j | node -e '
  const name = process.argv[1];
  const devices = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat();
  process.stdout.write(devices.find((d) => d.name === name)?.udid ?? "");
' "$SIMULATOR")"
if [[ -z "$udid" ]]; then
  # El runtime pedido (o el más nuevo) y el iPhone Pro más nuevo que ese runtime soporte.
  read -r runtime device_type < <(xcrun simctl list runtimes available -j | node -e '
    const version = process.argv[1];
    const ios = JSON.parse(require("fs").readFileSync(0, "utf8")).runtimes.filter((r) => r.platform === "iOS");
    const runtime = ios.filter((r) => !version || r.version === version || r.version.startsWith(`${version}.`)).at(-1);
    if (!runtime) {
      console.error(`No hay un runtime de iOS ${version}: xcodebuild -downloadPlatform iOS -buildVersion ${version}.x`);
      process.exit(1);
    }
    const number = (t) => parseInt(t.name.slice("iPhone ".length));
    const pros = runtime.supportedDeviceTypes.filter((t) => /^iPhone \d+ Pro$/.test(t.name));
    pros.sort((a, b) => number(a) - number(b));
    console.log(runtime.identifier, pros.at(-1).identifier);
  ' "$IOS_RUNTIME")
  udid="$(xcrun simctl create "$SIMULATOR" "$device_type" "$runtime")"
fi
xcrun simctl bootstatus "$udid" -b >/dev/null
xcrun simctl install "$udid" "$APP"

step "Base de test"
"$PYTHON" "$BACKEND/scripts/e2e.py" seed

step "API en el puerto $API_PORT"
"$PYTHON" "$BACKEND/scripts/e2e.py" serve --port "$API_PORT" >"$MOBILE/e2e/api.log" 2>&1 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
for _ in $(seq 60); do
  curl -fs "http://localhost:$API_PORT/health" >/dev/null && break
  kill -0 "$api_pid" 2>/dev/null || { cat "$MOBILE/e2e/api.log"; exit 1; }
  sleep 1
done

step "Maestro"
# Los datos salen del mismo archivo que usan el seed y Playwright.
fixtures="$BACKEND/scripts/e2e_fixtures.json"
maestro_env=()
while IFS= read -r pair; do maestro_env+=(-e "$pair"); done < <(node -e '
  const f = require(process.argv[1]);
  console.log(`MEMBER_EMAIL=${f.member_email}`);
  console.log(`PASSWORD=${f.password}`);
  console.log(`COURT=${f.courts[0]}`);
' "$fixtures")
maestro --device "$udid" test "${maestro_env[@]}" --test-output-dir "$OUTPUT" "$MOBILE/.maestro"
