"use client";

import { StateView } from "@/components/shared/state-view";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StateView
      variant="error"
      title="Algo salió mal en esta sección"
      description="Probá de nuevo. Si sigue pasando, avisanos."
      action={{ label: "Reintentar", onClick: reset }}
    />
  );
}
