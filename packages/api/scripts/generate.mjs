// Regenera src/schema.d.ts desde el OpenAPI del backend.
// Uso: pnpm --filter @clubsystem/api generate  (requiere el venv del backend: backend/.venv)
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, "../../../backend");
const venvPython = resolve(backend, ".venv/bin/python");
const python = existsSync(venvPython) ? venvPython : "python3";

const openapi = execFileSync(python, ["scripts/export_openapi.py"], { cwd: backend });
const specPath = resolve(here, "../openapi.json");
writeFileSync(specPath, openapi);
execFileSync(
  "npx",
  ["openapi-typescript", specPath, "-o", resolve(here, "../src/schema.d.ts"), "--root-types", "--root-types-no-schema-prefix"],
  { stdio: "inherit", cwd: resolve(here, "..") },
);
