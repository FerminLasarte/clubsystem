import type { ExpenseOut } from "@clubsystem/api";
import { Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Texto redactado por un LLM a partir del análisis estadístico. Es solo una ayuda: puede
 * equivocarse o haber sido manipulado por el contenido del gasto (AUDIT SEC-11), así que
 * nunca se presenta como un hecho ni decide nada.
 */
export function AiExplanation({ expense }: { expense: ExpenseOut }) {
  switch (expense.explanation_status) {
    case "not_needed":
      return null;
    case "pending":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Generando explicación…
        </p>
      );
    case "unavailable":
      return <p className="text-sm text-muted-foreground">No hay explicación disponible.</p>;
    case "ready":
      return (
        <section aria-labelledby="ai-explanation-title" className="grid gap-2 rounded-lg border border-dashed p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ai-explanation-title" className="text-sm font-medium">
              Posible explicación
            </h3>
            <Badge variant="outline">
              <Sparkles aria-hidden /> Generado por IA · no verificado
            </Badge>
          </div>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{expense.anomaly_explanation}</p>
          {expense.anomaly_recommended_action ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Sugerencia: </span>
              {expense.anomaly_recommended_action}
            </p>
          ) : null}
        </section>
      );
  }
}
