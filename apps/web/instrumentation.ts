import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring";

// Servidor y edge de Next (proxy.ts). El navegador se inicializa en instrumentation-client.ts.
export function register(): void {
  Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
