import type { ReservationStatus } from "@clubsystem/api";
import { RESERVATION_STATUS_LABELS } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS } from "@/features/reservations/status";

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge className={STATUS_BADGE_CLASS[status]}>{RESERVATION_STATUS_LABELS[status]}</Badge>;
}
