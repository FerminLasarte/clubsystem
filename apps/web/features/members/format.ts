import { daysBetween, localDayOf, todayIn } from "@clubsystem/shared";

const relative = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

/** Distancia en días calendario (zona del club) entre hoy y `iso`: "hoy", "ayer", "hace 3 semanas"… */
export function formatRelativeDay(iso: string, timeZone: string): string {
  const days = daysBetween(todayIn(timeZone), localDayOf(iso, timeZone));
  const abs = Math.abs(days);
  if (abs < 7) return relative.format(days, "day");
  if (abs < 30) return relative.format(Math.trunc(days / 7), "week");
  if (abs < 365) return relative.format(Math.trunc(days / 30), "month");
  return relative.format(Math.trunc(days / 365), "year");
}
