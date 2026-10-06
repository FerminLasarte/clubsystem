import type { MembershipStatus } from "@clubsystem/api";
import { MEMBERSHIP_STATUS_LABELS } from "@clubsystem/shared";

import type { Tone } from "@/shared/theme/tokens";

export const MEMBERSHIP_STATUS_TONE: Record<MembershipStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  INACTIVE: "neutral",
};

/** Texto del badge en el directorio, desde el punto de vista del socio. */
export function membershipLabel(status: MembershipStatus): string {
  return status === "PENDING" ? "Solicitud pendiente" : status === "APPROVED" ? "Sos socio" : MEMBERSHIP_STATUS_LABELS[status];
}

/** Sin membresía, o una rechazada o dada de baja: el backend acepta una solicitud nueva. */
export function canRequestMembership(status: MembershipStatus | null | undefined): boolean {
  return !status || status === "REJECTED" || status === "INACTIVE";
}
