import { todayIn } from "@clubsystem/shared";

const DAY_MS = 86_400_000;
const relative = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

/** "YYYY-MM-DD" del instante `iso` en la zona del club. */
function dayIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** Distancia en días calendario (zona del club) entre hoy y `iso`: "hoy", "ayer", "hace 3 semanas"… */
export function formatRelativeDay(iso: string, timeZone: string): string {
  const days = Math.round((Date.parse(dayIn(iso, timeZone)) - Date.parse(todayIn(timeZone))) / DAY_MS);
  const abs = Math.abs(days);
  if (abs < 7) return relative.format(days, "day");
  if (abs < 30) return relative.format(Math.trunc(days / 7), "week");
  if (abs < 365) return relative.format(Math.trunc(days / 30), "month");
  return relative.format(Math.trunc(days / 365), "year");
}

/** Texto de un campo opcional de formulario: vacío → null (la API lo interpreta como "limpiar"). */
export function optionalText(value: FormDataEntryValue | null): string | null {
  const text = value?.toString().trim() ?? "";
  return text === "" ? null : text;
}
