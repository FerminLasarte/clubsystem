import * as SecureStore from "expo-secure-store";

/**
 * Sesión del socio: tokens en SecureStore (más una copia en memoria del access token)
 * y el estado de autenticación que consume la navegación.
 */

export type AuthStatus = "loading" | "signedIn" | "signedOut";

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

const ACCESS_KEY = "clubsystem.access_token";
const REFRESH_KEY = "clubsystem.refresh_token";
/** Margen para no mandar un token que vence en vuelo. */
const EXPIRY_MARGIN_MS = 30_000;

let status: AuthStatus = "loading";
let accessToken: string | null = null;
const listeners = new Set<() => void>();

function setStatus(next: AuthStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

/** `exp` del JWT en milisegundos, o null si el token no se puede leer. */
export function tokenExpiresAt(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const claims: unknown = JSON.parse(atob(padded));
    if (typeof claims === "object" && claims !== null && "exp" in claims && typeof claims.exp === "number") {
      return claims.exp * 1000;
    }
    return null;
  } catch {
    return null; // token corrupto: se trata como vencido
  }
}

function isExpired(token: string): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt === null || expiresAt - EXPIRY_MARGIN_MS <= Date.now();
}

export const session = {
  getStatus: (): AuthStatus => status,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getAccessToken: async (): Promise<string | null> => accessToken,

  getRefreshToken: (): Promise<string | null> => SecureStore.getItemAsync(REFRESH_KEY),

  /** Guarda tokens nuevos. El refresh es rotativo: siempre se reemplaza el anterior. */
  async saveTokens(tokens: SessionTokens): Promise<void> {
    accessToken = tokens.access_token;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token),
    ]);
  },

  async start(tokens: SessionTokens): Promise<void> {
    await session.saveTokens(tokens);
    setStatus("signedIn");
  },

  /** Logout local: borra los tokens y vuelve a la pantalla de ingreso. */
  async end(): Promise<void> {
    accessToken = null;
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
    setStatus("signedOut");
  },

  /**
   * Restaura la sesión guardada al abrir la app. Si el access token venció (se lee su `exp`),
   * lo renueva antes de entrar; si el refresh ya no sirve, la sesión termina.
   */
  async restore(refresh: () => Promise<boolean>): Promise<void> {
    const [storedAccess, storedRefresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    if (!storedRefresh) {
      await session.end();
      return;
    }
    accessToken = storedAccess;
    if (!storedAccess || isExpired(storedAccess)) {
      try {
        if (!(await refresh())) {
          await session.end();
          return;
        }
      } catch {
        // Sin red: se entra igual y las pantallas muestran el error con reintento.
      }
    }
    setStatus("signedIn");
  },
};
