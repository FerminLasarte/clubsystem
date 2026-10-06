import { errorMessage } from "@clubsystem/api";
import { AlertTriangle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StateViewProps {
  variant: "empty" | "error";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  fullScreen?: boolean;
}

/** Estado vacío o de error. Nunca se muestra un error como si fuera "no hay datos". */
export function StateView({ variant, title, description, action, fullScreen }: StateViewProps) {
  const Icon = variant === "error" ? AlertTriangle : Inbox;
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        fullScreen && "min-h-svh border-0",
      )}
    >
      <Icon className={cn("size-8", variant === "error" ? "text-destructive" : "text-muted-foreground")} aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** Atajo para el error de una query con botón de reintento. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <StateView
      variant="error"
      title="No pudimos cargar los datos"
      description={errorMessage(error)}
      action={{ label: "Reintentar", onClick: onRetry }}
    />
  );
}
