import type { StockMovementType } from "@clubsystem/api";
import { STOCK_MOVEMENT_TYPE_LABELS } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<StockMovementType, string> = {
  IN: "bg-success/10 text-success",
  OUT: "bg-destructive/10 text-destructive",
  ADJUSTMENT: "bg-info/10 text-info",
};

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  return <Badge className={cn(TONES[type])}>{STOCK_MOVEMENT_TYPE_LABELS[type]}</Badge>;
}
