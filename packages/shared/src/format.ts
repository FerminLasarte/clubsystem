import { STOCK_UNIT_SHORT_LABELS } from "./labels";

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

const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** Cantidades de stock (llegan como string decimal, "12.500"), opcionalmente con la unidad abreviada. */
export function formatQuantity(value: string | number, unit?: keyof typeof STOCK_UNIT_SHORT_LABELS): string {
  const n = typeof value === "number" ? value : Number(value);
  const text = Number.isFinite(n) ? quantity.format(n) : "—";
  return unit ? `${text} ${STOCK_UNIT_SHORT_LABELS[unit]}` : text;
}

/**
 * Fecha de un instante (ISO con hora) en la zona horaria del club (no la del dispositivo).
 * Para días sin hora ("YYYY-MM-DD") usar `formatDay` de ./dates: acá se correrían un día.
 */
export function formatDate(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone, ...opts }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(
    new Date(iso),
  );
}

/** "7 oct 2026, 23:30". Se arma con las dos de arriba: con `timeStyle`, es-AR usa 12 h ("11:30 p. m.") desde CLDR 48. */
export function formatDateTime(iso: string, timeZone: string): string {
  return `${formatDate(iso, timeZone)}, ${formatTime(iso, timeZone)}`;
}

export function initials(firstName: string | null | undefined, lastName?: string | null): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

/** "1 gasto", "3 gastos": cantidad con el sustantivo en singular o plural. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
