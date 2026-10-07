"use client";

import { StateView } from "@/components/shared/state-view";
import { useReportError } from "@/lib/use-report-error";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useReportError(error);
  return (
    <StateView
      variant="error"
      title="Algo salió mal en esta sección"
      description="Probá de nuevo. Si sigue pasando, avisanos."
      action={{ label: "Reintentar", onClick: reset }}
    />
  );
}
