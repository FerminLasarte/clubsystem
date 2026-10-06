/**
 * Fechas de calendario ("YYYY-MM-DD", sin hora). No dependen de ninguna zona horaria:
 * se manejan como medianoche UTC solo para hacer cuentas y formatearlas.
 * "Hoy" se obtiene siempre con `todayIn(timezone del club)`.
 */

function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Suma (o resta) días a una fecha de calendario. */
export function shiftDay(day: string, days: number): string {
  const date = toUtcDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isCalendarDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtcDate(value).getTime());
}

export function formatCalendarDate(day: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone: "UTC" }).format(toUtcDate(day));
}

/** "octubre de 2026" (o "oct 2026" con `short`). */
export function formatMonth(year: number, month: number, short = false): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Año y mes de una fecha de calendario. */
export function yearMonthOf(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}
