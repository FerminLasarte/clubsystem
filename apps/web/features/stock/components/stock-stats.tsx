"use client";

import { formatMoney } from "@clubsystem/shared";
import { AlertTriangle, Boxes, Wallet } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { QueryError } from "@/components/shared/state-view";
import { useStockStats } from "@/features/stock/api";

export function StockStats() {
  const stats = useStockStats();
  if (stats.isError) return <QueryError error={stats.error} onRetry={() => stats.refetch()} />;

  const lowCount = stats.data?.low_stock_count;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Ítems" value={stats.data?.total_items} icon={Boxes} />
      <StatCard
        label="Valor del inventario"
        value={stats.data ? formatMoney(stats.data.inventory_value) : undefined}
        icon={Wallet}
        tone="info"
        hint="Cantidad × costo unitario"
      />
      <StatCard
        label="Stock bajo"
        value={lowCount}
        icon={AlertTriangle}
        tone={lowCount ? "warning" : "success"}
        hint="En o por debajo del mínimo"
      />
    </div>
  );
}
