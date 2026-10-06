import type { MembershipStatus } from "@clubsystem/api";
import { MEMBERSHIP_STATUS_LABELS } from "@clubsystem/shared";

import type { Tone } from "@/shared/theme/tokens";

export const MEMBERSHIP_STATUS_TONE: Record<MembershipStatus, Tone> = {
  INVITED: "warning",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  INACTIVE: "neutral",
};

/** Texto del badge en el directorio, desde el punto de vista del socio. */
export function membershipLabel(status: MembershipStatus): string {
  switch (status) {
    case "INVITED":
      return "Te invitaron";
    case "PENDING":
      return "Solicitud pendiente";
    case "APPROVED":
      return "Sos socio";
    default:
      return MEMBERSHIP_STATUS_LABELS[status];
  }
}

/**
 * Sin membresía, rechazada o dada de baja: el backend acepta una solicitud nueva.
 * Con una invitación, solicitar la acepta directamente (queda aprobada).
 */
export function canRequestMembership(status: MembershipStatus | null | undefined): boolean {
  return !status || status === "INVITED" || status === "REJECTED" || status === "INACTIVE";
}

export function requestLabel(status: MembershipStatus | null | undefined): string {
  if (status === "INVITED") return "Aceptar invitación";
  return status ? "Volver a solicitar membresía" : "Solicitar membresía";
}
