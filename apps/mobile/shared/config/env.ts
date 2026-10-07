import Constants from "expo-constants";

/** URL del backend, definida en app.config.ts a partir de EXPO_PUBLIC_API_URL. */
function readApiUrl(): string {
  const value: unknown = Constants.expoConfig?.extra?.apiUrl;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Falta la URL del backend (EXPO_PUBLIC_API_URL).");
  }
  return value.replace(/\/+$/, "");
}

/** DSN de Sentry, definido en app.config.ts a partir de EXPO_PUBLIC_SENTRY_DSN. Vacío: monitoreo apagado. */
function readSentryDsn(): string | null {
  const value: unknown = Constants.expoConfig?.extra?.sentryDsn;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const env = {
  apiUrl: readApiUrl(),
  sentryDsn: readSentryDsn(),
} as const;
