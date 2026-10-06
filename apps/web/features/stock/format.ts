import type { StockUnit } from "@clubsystem/api";

const UNIT_SHORT: Record<StockUnit, string> = {
  unit: "u.",
  box: "cajas",
  kg: "kg",
  liter: "L",
  pack: "packs",
};

const quantityFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** Las cantidades llegan como string decimal ("12.500"). */
export function formatQuantity(value: string | number, unit?: StockUnit): string {
  const n = typeof value === "number" ? value : Number(value);
  const text = Number.isFinite(n) ? quantityFormat.format(n) : "—";
  return unit ? `${text} ${UNIT_SHORT[unit]}` : text;
}

/** Variación con signo explícito: "+5", "−2,5". */
export function formatDelta(value: string, unit: StockUnit): string {
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatQuantity(Math.abs(n), unit)}`;
}
