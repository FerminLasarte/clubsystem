import { monitoringContext } from "@clubsystem/api";
import { scrubMonitoringEvent } from "@clubsystem/shared";
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Opciones de Sentry del navegador, el servidor y el edge. Sin DSN queda apagado (desarrollo y CI).
 * Sin Session Replay ni datos personales: todo evento pasa por `scrubMonitoringEvent`.
 */
export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  sendDefaultPii: false,
  beforeSend: scrubMonitoringEvent,
  beforeSendTransaction: scrubMonitoringEvent,
  beforeBreadcrumb: scrubMonitoringEvent,
} satisfies Parameters<typeof Sentry.init>[0];

/** Reporta un error inesperado (no los 4xx ni los cortes de red), con el request_id si vino del backend. */
export function reportError(error: unknown): void {
  const context = monitoringContext(error);
  if (context) Sentry.captureException(error, context);
}
