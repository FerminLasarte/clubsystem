import type { StockUnit } from "@clubsystem/api";
import { formatQuantity } from "@clubsystem/shared";

/** Variación con signo explícito: "+5", "−2,5". */
export function formatDelta(value: string, unit: StockUnit): string {
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatQuantity(Math.abs(n), unit)}`;
}
