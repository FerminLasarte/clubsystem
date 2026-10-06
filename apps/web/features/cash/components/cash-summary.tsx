import type { CashSummary } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import { Scale, TrendingDown, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";

/** Ingresos, egresos y neto del día. Sin `summary` muestra el skeleton de cada tarjeta. */
export function CashSummaryCards({ summary }: { summary: CashSummary | undefined }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Ingresos" value={summary && formatMoney(summary.income)} icon={TrendingUp} tone="success" />
      <StatCard label="Egresos" value={summary && formatMoney(summary.outflow)} icon={TrendingDown} tone="danger" />
      <StatCard label="Neto" value={summary && formatMoney(summary.net)} icon={Scale} tone="info" />
    </div>
  );
}
