import type { TransactionType } from "@clubsystem/api";
import { TRANSACTION_TYPE_LABELS } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";

export function MovementTypeBadge({ type }: { type: TransactionType }) {
  return (
    <Badge className={type === "INCOME" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
      {TRANSACTION_TYPE_LABELS[type]}
    </Badge>
  );
}
