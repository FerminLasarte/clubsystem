/**
 * Fechas sin dependencias de la zona del dispositivo.
 *
 * - Un "día" es un string "YYYY-MM-DD" (campos `date` de la API: joined_on, due_date, expense_date…).
 *   No tiene zona: se opera y se formatea en UTC para que nunca se corra un día.
 * - Un "instante" es un ISO 8601 con zona (campos `date-time`). Se muestra en la zona del club
 *   (`formatDate`, `formatTime`, `formatDateTime` de ./format).
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function dayToUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** true si `value` es un día "YYYY-MM-DD" válido (p. ej. leído de la URL o de un input). */
export function isIsoDay(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const date = dayToUtc(value);
  // Descarta días inexistentes como "2026-02-30" (Date los acepta corriéndolos de mes).
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** "6 oct 2026" (o el estilo pedido) para un día sin hora. */
export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone: "UTC" }).format(dayToUtc(day));
}

/** Suma (o resta) días a un día. */
export function shiftDay(day: string, days: number): string {
  const date = dayToUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Días de calendario de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to).getTime() - dayToUtc(from).getTime()) / DAY_MS);
}

/** Año y mes (1-12) de un día. */
export function yearMonthOf(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

/** "octubre de 2026" (o "oct 2026" con `short`). `month` va de 1 a 12. */
export function monthLabel(year: number, month: number, short = false): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

// ── Instantes en la zona del club ──────────────────────────────────────────────

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

/** Día ("YYYY-MM-DD") y hora ("HH:MM") de pared de un instante en `timeZone`. */
function wallClock(instant: Date, timeZone: string): { day: string; time: string } {
  let formatter = wallClockFormatters.get(timeZone);
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
    wallClockFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  const hour = String(Number(parts.hour) % 24).padStart(2, "0");
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
}

/** Día ("YYYY-MM-DD") de un instante en la zona indicada. */
export function localDayOf(iso: string, timeZone: string): string {
  return wallClock(new Date(iso), timeZone).day;
}

/** Hora de pared ("HH:MM") de un instante en la zona indicada. */
export function localTimeOf(iso: string, timeZone: string): string {
  return wallClock(new Date(iso), timeZone).time;
}

/** "YYYY-MM-DD" de hoy en la zona horaria indicada. */
export function todayIn(timeZone: string): string {
  return wallClock(new Date(), timeZone).day;
}

/**
 * Instante (ISO UTC) que corresponde a un día y una hora ("HH:MM") de pared en `timeZone`.
 * Tiene en cuenta los cambios de horario (DST).
 */
export function zonedToIso(day: string, time: string, timeZone: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const wallAsUtc = dayToUtc(day).getTime() + (hours * 60 + minutes) * 60_000;
  const offsetAt = (utcMs: number) => {
    const wall = wallClock(new Date(utcMs), timeZone);
    return Date.parse(`${wall.day}T${wall.time}:00Z`) - utcMs;
  };
  // Dos pasadas: la segunda corrige si el offset cambia (horario de verano) entre la estimación y el resultado.
  const guess = wallAsUtc - offsetAt(wallAsUtc);
  return new Date(wallAsUtc - offsetAt(guess)).toISOString();
}
