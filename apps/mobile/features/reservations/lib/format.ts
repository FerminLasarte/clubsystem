import type { CourtSurface, MyReservationOut, ReservationStatus, Sport } from "@clubsystem/api";
import { COURT_SURFACE_LABELS, formatDate, formatTime, RESERVATION_STATUS_LABELS, SPORT_LABELS } from "@clubsystem/shared";

import type { Tone } from "@/shared/theme/tokens";

export const RESERVATION_STATUS_TONE: Record<ReservationStatus, Tone> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "danger",
  completed: "neutral",
};

/** Las reservas hechas desde la app quedan pendientes hasta que el club las confirma (Anexo C). */
export const PENDING_EXPLANATION =
  "El club tiene que confirmarla. Si no la confirma antes del horario de inicio, se cancela automáticamente.";

export function statusLabel(status: ReservationStatus): string {
  return RESERVATION_STATUS_LABELS[status];
}

/** "mar., 14 oct." en la zona del club. */
export function reservationDay(r: Pick<MyReservationOut, "starts_at" | "club">): string {
  return formatDate(r.starts_at, r.club.timezone, { dateStyle: undefined, weekday: "short", day: "numeric", month: "short" });
}

/** "18:00 – 19:30" en la zona del club. */
export function timeRange(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`;
}

/** "Pádel · Sintético · Techada" */
export function courtDescription(court: { sport: Sport; surface: CourtSurface | null; is_indoor: boolean }): string {
  return [SPORT_LABELS[court.sport], court.surface ? COURT_SURFACE_LABELS[court.surface] : null, court.is_indoor ? "Techada" : null]
    .filter(Boolean)
    .join(" · ");
}
