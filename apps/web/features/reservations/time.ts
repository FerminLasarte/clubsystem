/**
 * Horas de la grilla de reservas. Un "día" es un string "YYYY-MM-DD" (día local del club);
 * la aritmética de días y la conversión con la zona del club están en `@clubsystem/shared`.
 * Funciones puras: no calculan disponibilidad ni precios (eso lo hace el backend).
 */

import { localDayOf, localTimeOf } from "@clubsystem/shared";

const MINUTES_PER_DAY = 24 * 60;

/** "HH:MM" o "HH:MM:SS" → minutos desde las 00:00. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Día local y minutos desde las 00:00 de un instante, en la zona del club. */
export function localParts(iso: string, timeZone: string): { day: string; minutes: number; time: string } {
  const time = localTimeOf(iso, timeZone);
  return { day: localDayOf(iso, timeZone), minutes: timeToMinutes(time), time };
}
