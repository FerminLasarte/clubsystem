/** Días reservables a partir de "hoy" en la zona del club. Funciones puras, sin depender del dispositivo. */

export const BOOKING_DAYS = 14;

export interface DayOption {
  /** "YYYY-MM-DD" (lo que espera el backend). */
  date: string;
  label: string;
  detail: string;
}

/** Suma días a una fecha "YYYY-MM-DD" sin pasar por la zona horaria del dispositivo. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });

/** `count` días desde `today` (que ya viene calculado en la zona del club). */
export function bookingDays(today: string, count = BOOKING_DAYS): DayOption[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i);
    const asUtc = new Date(`${date}T00:00:00Z`);
    const label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : weekday.format(asUtc);
    return { date, label, detail: dayMonth.format(asUtc) };
  });
}
