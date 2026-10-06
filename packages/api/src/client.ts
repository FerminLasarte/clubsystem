import createClient from "openapi-fetch";

import { ApiError, toApiError } from "./errors";
import type { paths } from "./schema";

export type AuthMode =
  /** Panel web: tokens en cookies HttpOnly (mismo origen vía rewrite de Next). */
  | { kind: "cookie" }
  /** App mobile: Bearer guardado en almacenamiento seguro. */
  | { kind: "bearer"; getAccessToken: () => Promise<string | null> };

export interface ApiClientOptions {
  baseUrl: string;
  auth: AuthMode;
  /** Renueva la sesión. Devuelve true si se obtuvo un access token nuevo. */
  refreshSession: () => Promise<boolean>;
  /** Se llama cuando la sesión no se pudo renovar (logout local). */
  onSessionExpired: () => void;
  timeoutMs?: number;
}

const AUTH_PATHS = ["/api/v1/auth/web/login", "/api/v1/auth/mobile/login", "/api/v1/auth/web/refresh", "/api/v1/auth/mobile/refresh"];

export function createApiClient(options: ApiClientOptions) {
  const timeoutMs = options.timeoutMs ?? 15_000;
  let refreshing: Promise<boolean> | null = null;

  // Un solo refresh en vuelo aunque fallen varias requests a la vez.
  const refreshOnce = (): Promise<boolean> => {
    refreshing ??= options.refreshSession().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const send = async (request: Request): Promise<Response> => {
    const headers = new Headers(request.headers);
    // Anti-CSRF: el backend exige este header en mutaciones autenticadas por cookie.
    headers.set("x-requested-with", "clubsystem");
    if (options.auth.kind === "bearer") {
      const token = await options.auth.getAccessToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
    try {
      return await fetch(new Request(request, { headers, signal }));
    } catch (cause) {
      if (request.signal.aborted) throw cause; // cancelación del llamador (p. ej. React Query)
      throw ApiError.network(cause);
    }
  };

  const authedFetch = async (input: Request): Promise<Response> => {
    const retry = input.clone();
    const response = await send(input);
    const isAuthCall = AUTH_PATHS.some((p) => new URL(input.url).pathname === p);
    if (response.status !== 401 || isAuthCall) return response;
    if (await refreshOnce()) return send(retry);
    options.onSessionExpired();
    return response;
  };

  return createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: options.auth.kind === "cookie" ? "include" : "omit",
    fetch: authedFetch,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Convierte el resultado de openapi-fetch en datos o en un ApiError lanzado. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) throw toApiError(response.status, error);
  return data as T;
}
