import type { TransactionType } from "@clubsystem/api";

import { Badge } from "@/components/ui/badge";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  OUTFLOW: "Egreso",
};

export function MovementTypeBadge({ type }: { type: TransactionType }) {
  return (
    <Badge className={type === "INCOME" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
      {TRANSACTION_TYPE_LABELS[type]}
    </Badge>
  );
}
