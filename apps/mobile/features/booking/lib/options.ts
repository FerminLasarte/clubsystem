import type { AppDuration, MemberCourtOut, Sport } from "@clubsystem/api";

/** Duraciones que acepta el backend para reservas desde la app (`AppDuration`). */
export const DURATIONS: readonly AppDuration[] = [60, 90, 120];

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** Deportes con al menos una cancha activa, en el orden en que llegan. */
export function sportsOf(courts: MemberCourtOut[] | undefined): Sport[] {
  return [...new Set((courts ?? []).map((c) => c.sport))];
}
