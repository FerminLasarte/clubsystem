import { monitoringContext } from "@clubsystem/api";
import { scrubMonitoringEvent } from "@clubsystem/shared";
import * as Sentry from "@sentry/react-native";

import { env } from "@/shared/config/env";

/**
 * Sentry de la app. Sin DSN no se inicializa (desarrollo y e2e). Sin Session Replay, capturas de
 * pantalla ni datos personales: todo evento pasa por `scrubMonitoringEvent`.
 */
export function initMonitoring(): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: __DEV__ ? "development" : "production",
    // Fijo: cambiarlo requiere un build nuevo de todas formas. El backend sigue la decisión del trace.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubMonitoringEvent,
    beforeSendTransaction: scrubMonitoringEvent,
    beforeBreadcrumb: scrubMonitoringEvent,
  });
}

/** Reporta un error inesperado (no los 4xx ni los cortes de red), con el request_id si vino del backend. */
export function reportError(error: unknown): void {
  const context = monitoringContext(error);
  if (context) Sentry.captureException(error, context);
}
