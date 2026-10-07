"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { makeQueryClient } from "@/lib/query-client";

/** Los `richColors` de Sonner con nuestros tokens: los suyos no llegan al contraste AA (4,5:1). */
const TOAST_COLORS = {
  "--success-bg": "color-mix(in oklab, var(--success) 10%, var(--popover))",
  "--success-border": "color-mix(in oklab, var(--success) 30%, var(--popover))",
  "--success-text": "var(--success)",
  "--info-bg": "color-mix(in oklab, var(--info) 10%, var(--popover))",
  "--info-border": "color-mix(in oklab, var(--info) 30%, var(--popover))",
  "--info-text": "var(--info)",
  "--warning-bg": "color-mix(in oklab, var(--warning) 15%, var(--popover))",
  "--warning-border": "color-mix(in oklab, var(--warning) 40%, var(--popover))",
  "--warning-text": "var(--warning-foreground)",
  "--error-bg": "color-mix(in oklab, var(--destructive) 10%, var(--popover))",
  "--error-border": "color-mix(in oklab, var(--destructive) 30%, var(--popover))",
  "--error-text": "var(--destructive)",
} as CSSProperties;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-right" richColors closeButton style={TOAST_COLORS} />
    </QueryClientProvider>
  );
}
