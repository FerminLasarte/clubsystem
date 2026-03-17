// apps/web/components/expenses/AnomalyBadge.tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

type Severity = "low" | "medium" | "high" | "critical" | null | undefined;

const CONFIG: Record<
  NonNullable<Severity>,
  { label: string; classes: string; icon: typeof AlertTriangle }
> = {
  low:      { label: "Baja",     classes: "bg-yellow-50 text-yellow-600 border-yellow-200",  icon: Info },
  medium:   { label: "Media",    classes: "bg-orange-50 text-orange-600 border-orange-200",  icon: AlertTriangle },
  high:     { label: "Alta",     classes: "bg-red-50 text-red-600 border-red-200",           icon: AlertTriangle },
  critical: { label: "Crítica",  classes: "bg-red-100 text-red-700 border-red-300",          icon: AlertTriangle },
};

interface AnomalyBadgeProps {
  severity?: Severity;
  reason?: string | null;
}

export function AnomalyBadge({ severity, reason }: AnomalyBadgeProps) {
  if (!severity) {
    return (
      <div className="flex justify-center">
        <CheckCircle className="h-4 w-4 text-gray-200" />
      </div>
    );
  }

  const { label, classes, icon: Icon } = CONFIG[severity];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium cursor-default ${classes}`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        </TooltipTrigger>
        {reason && (
          <TooltipContent
            side="left"
            className="max-w-xs text-xs text-gray-600 bg-white border border-gray-100 shadow-sm"
          >
            <p className="font-medium text-gray-900 mb-1">Anomalía detectada</p>
            <p>{reason}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
