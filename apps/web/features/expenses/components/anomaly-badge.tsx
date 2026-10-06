import type { AnomalySeverity } from "@clubsystem/api";
import { ANOMALY_SEVERITY_LABELS } from "@clubsystem/shared";
import { AlertTriangle, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SEVERITY_TONES } from "@/features/expenses/labels";
import { cn } from "@/lib/utils";

interface AnomalyBadgeProps {
  severity: AnomalySeverity;
  reviewed?: boolean;
}

/** Severidad decidida por la estadística del backend. */
export function AnomalyBadge({ severity, reviewed }: AnomalyBadgeProps) {
  return (
    <Badge className={cn(SEVERITY_TONES[severity], reviewed && "opacity-60")}>
      {reviewed ? <Check aria-hidden /> : <AlertTriangle aria-hidden />}
      {ANOMALY_SEVERITY_LABELS[severity]}
      {reviewed ? <span className="sr-only"> (revisada)</span> : null}
    </Badge>
  );
}
