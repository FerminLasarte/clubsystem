import type { FeeStatus } from "@clubsystem/api";
import { FEE_STATUS_LABELS } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";

const TONES: Record<FeeStatus, string> = {
  PENDING: "bg-warning/15 text-warning-foreground",
  PAID: "bg-success/10 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  return <Badge className={TONES[status]}>{FEE_STATUS_LABELS[status]}</Badge>;
}
