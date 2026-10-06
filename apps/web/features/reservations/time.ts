/**
 * Fechas y horas en la zona del club. Un "día" es un string "YYYY-MM-DD" (día local del club).
 * Funciones puras: no calculan disponibilidad ni precios (eso lo hace el backend).
 */

import { formatDate } from "@clubsystem/shared";

const MINUTES_PER_DAY = 24 * 60;

/** Devuelve el día si tiene formato "YYYY-MM-DD" válido (p. ej. desde la URL); si no, null. */
export function parseDay(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value;
}

/** Aritmética de calendario sobre "YYYY-MM-DD" (UTC solo como soporte, no representa "hoy"). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

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

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

/** Día local y minutos desde las 00:00 de un instante, en la zona del club. */
export function localParts(iso: string, timeZone: string): { day: string; minutes: number; time: string } {
  const { day, minutes } = wallClock(new Date(iso), timeZone);
  return { day, minutes, time: minutesToTime(minutes) };
}

/** Instante (ISO UTC) que corresponde a un día y hora locales del club. */
export function zonedToIso(day: string, time: string, timeZone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d) + timeToMinutes(time) * 60_000;
  const offsetAt = (ts: number) => {
    const wall = wallClock(new Date(ts), timeZone);
    return Date.parse(`${wall.day}T00:00:00Z`) + wall.minutes * 60_000 - ts;
  };
  // Dos pasadas: la segunda corrige si el offset cambia (horario de verano) entre la estimación y el resultado.
  const first = target - offsetAt(target);
  return new Date(target - offsetAt(first)).toISOString();
}

/** "lunes, 6 de octubre de 2026" para un día local. */
export function formatDayLong(day: string): string {
  // Un día de calendario no tiene zona: se formatea al mediodía UTC para que no cambie de fecha.
  return formatDate(`${day}T12:00:00Z`, "UTC", { dateStyle: "full" });
}
