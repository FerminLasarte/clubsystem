/**
 * Lo que sale hacia el monitoreo de errores (Sentry) desde el panel y la app. Mismas reglas que
 * backend/app/core/monitoring.py: nunca cuerpos de requests, cookies, headers de auth, emails, DNI
 * ni tokens (por ejemplo el de una invitación en la URL de la página).
 */

export const FILTERED = "[Filtered]";

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "cookie", "email", "dni"];
const SAFE_HEADERS = new Set(["accept", "content-type", "user-agent", "x-request-id"]);
const TEXT_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, FILTERED], // emails
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, FILTERED], // JWT
  [/bearer\s+\S+/gi, FILTERED],
  [/(^|[^\w.-])\d{1,2}\.?\d{3}\.?\d{3}(?![\w.-])/g, `$1${FILTERED}`], // DNI, con o sin puntos
  [/\?[^\s"'#]*=[^\s"'#]*/g, FILTERED], // query strings
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubText(text: string): string {
  return TEXT_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

function scrubValue(value: unknown, key = ""): unknown {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.some((k) => lower.includes(k))) return FILTERED;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v, k)]));
  return value;
}

/** Limpia en el lugar un evento, transacción o breadcrumb de Sentry (`beforeSend*`, `beforeBreadcrumb`). */
export function scrubMonitoringEvent<T extends object>(event: T): T {
  const request: unknown = Reflect.get(event, "request");
  if (isRecord(request)) {
    for (const field of ["data", "cookies", "query_string", "env"]) delete request[field];
    const headers = request.headers;
    if (isRecord(headers)) {
      request.headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
      );
    }
  }
  for (const [key, value] of Object.entries(event)) Reflect.set(event, key, scrubValue(value, key));
  return event;
}
