import { execFileSync } from "node:child_process";
import path from "node:path";

import fixtures from "../../../../backend/scripts/e2e_fixtures.json";

/** Puertos propios para no chocar con `next dev` (3000) ni con la API de desarrollo (8000). */
export const API_PORT = 8001;
export const WEB_PORT = 3001;

const backend = path.resolve(__dirname, "../../../../backend");
// Poetry crea el venv dentro de backend/ (poetry.toml), en local y en la CI.
const python = process.env.E2E_PYTHON ?? path.join(backend, ".venv/bin/python");
const script = path.join(backend, "scripts/e2e.py");

/** Comando de shell para `backend/scripts/e2e.py` (lo usa `webServer`). */
export function e2eCommand(...args: string[]): string {
  return [python, script, ...args].map((arg) => JSON.stringify(arg)).join(" ");
}

/** Vacía la base de test y carga los datos de `e2e_fixtures.json`. */
export function seedDatabase(): void {
  execFileSync(python, [script, "seed"], { stdio: "inherit" });
}

export { fixtures };
