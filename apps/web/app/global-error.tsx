"use client";

import { useReportError } from "@/lib/use-report-error";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useReportError(error);
  return (
    <html lang="es">
      <body className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 font-sans">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <button type="button" onClick={reset} className="rounded-md border px-4 py-2">
          Reintentar
        </button>
      </body>
    </html>
  );
}
