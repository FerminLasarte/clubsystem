/**
 * ClubSystem — Cliente API para el Portal del Jugador
 * =====================================================
 * Wrapper sobre fetch que:
 *   - Apunta a la URL base del backend (desde config/api.ts).
 *   - Lee el JWT desde SecureStore y lo adjunta como Bearer en cada petición.
 *   - Lanza un Error con el `detail` del backend si el status no es 2xx.
 *
 * Uso:
 *   import { apiClient } from "@/utils/api";
 *
 *   const reservations = await apiClient.get<ReservationMeOut[]>("/mobile/reservations/me");
 *   const auth = await apiClient.post<MobileAuthResponse>("/mobile/auth/login", { identifier, password });
 */

import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/config/api";

// ── Tipos internos ────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestConfig {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

// ── Core request ──────────────────────────────────────────────

async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("auth_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: config.method ?? "GET",
    headers,
    body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as { detail?: string }).detail ?? `Error ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// ── API Client ────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body });
  },

  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};
