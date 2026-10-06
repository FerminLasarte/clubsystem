import type { ReservationStatus } from "@clubsystem/api";

/** Colores por estado (tokens semánticos). Las etiquetas vienen de `@clubsystem/shared`. */
export const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  confirmed: "bg-success/10 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

/** Bloques de la grilla: borde izquierdo con el color del estado. */
export const STATUS_BLOCK_CLASS: Record<ReservationStatus, string> = {
  pending: "border-l-warning bg-warning/15 hover:bg-warning/25",
  confirmed: "border-l-success bg-success/10 hover:bg-success/20",
  completed: "border-l-muted-foreground bg-muted text-muted-foreground hover:bg-muted",
  cancelled: "border-l-destructive bg-destructive/10 line-through",
};

/** Pendientes y confirmadas se pueden cancelar, reprogramar o cambiar de precio. */
export function isActive(status: ReservationStatus): boolean {
  return status === "pending" || status === "confirmed";
}
