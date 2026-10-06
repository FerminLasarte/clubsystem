import { ApiError, createApiClient } from "@clubsystem/api";

import { env } from "@/shared/config/env";

import { session } from "./session";

/**
 * Renueva el access token con el refresh guardado. El refresh es rotativo: se guarda siempre el nuevo.
 * Devuelve false si el backend lo rechaza; ante un error de red lanza, para no cerrar la sesión por un corte.
 */
async function refreshSession(): Promise<boolean> {
  const refreshToken = await session.getRefreshToken();
  if (!refreshToken) return false;
  const { data, response } = await api.POST("/api/v1/auth/mobile/refresh", {
    body: { refresh_token: refreshToken },
  });
  if (data) {
    await session.saveTokens(data);
    return true;
  }
  if (response.status >= 500) throw new ApiError(response.status, "http_error", "El servidor no respondió.");
  return false;
}

function onSessionExpired(): void {
  void session.end();
}

/** Cliente HTTP de la app. Es el único lugar desde el que se habla con el backend. */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  auth: { kind: "bearer", getAccessToken: session.getAccessToken },
  refreshSession,
  onSessionExpired,
});

export const restoreSession = (): Promise<void> => session.restore(refreshSession);
