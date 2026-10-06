import { createApiClient } from "@clubsystem/api";

const SESSION_HINT_COOKIE = "cs_has_session";

async function refreshSession(): Promise<boolean> {
  const response = await fetch("/api/v1/auth/web/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "x-requested-with": "clubsystem" },
  });
  return response.ok;
}

function onSessionExpired(): void {
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa: descarta todo el estado del cliente
  window.location.assign(`/login?next=${next}`);
}

/** Cliente HTTP del panel. Mismo origen: Next reenvía /api/* al backend. */
export const api = createApiClient({
  baseUrl: typeof window === "undefined" ? (process.env.BACKEND_URL ?? "http://localhost:8000") : "",
  auth: { kind: "cookie" },
  refreshSession,
  onSessionExpired,
});
