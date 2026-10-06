import type { CourtSurface } from "@clubsystem/api";

/** Pendiente de mover a `@clubsystem/shared/labels` si otra pantalla la necesita. */
export const SURFACE_LABELS: Record<CourtSurface, string> = {
  clay: "Polvo de ladrillo",
  hard: "Cemento / dura",
  grass: "Césped",
  synthetic: "Sintético",
  wood: "Madera",
  concrete: "Hormigón",
  other: "Otra",
};
