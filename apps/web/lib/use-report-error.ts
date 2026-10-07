"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/monitoring";

/** Para los error boundaries de Next: el error ya lo atrapó React y no llega solo a Sentry. */
export function useReportError(error: Error): void {
  useEffect(() => reportError(error), [error]);
}
