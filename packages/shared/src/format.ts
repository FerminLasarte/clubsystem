/** Formato para Argentina. Los montos llegan de la API como string decimal ("8000.00"). */

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? money.format(n) : "—";
}

/** Fecha/hora en la zona horaria del club (no la del dispositivo). */
export function formatDate(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone, ...opts }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

/** "YYYY-MM-DD" de hoy en la zona horaria indicada. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function initials(firstName: string | null | undefined, lastName?: string | null): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}
