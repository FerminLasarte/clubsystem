"use client";

import type { ExpenseStatsOut } from "@clubsystem/api";
import { EXPENSE_CATEGORY_LABELS, formatDay, formatMoney, pluralize } from "@clubsystem/shared";
import { AlertTriangle, ReceiptText } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { QueryError } from "@/components/shared/state-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenseStats, type PeriodQuery } from "@/features/expenses/api";

function periodHint(stats: ExpenseStatsOut): string | undefined {
  const { date_from: from, date_to: to } = stats;
  if (from && to) return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  if (from) return `Desde ${formatDay(from)}`;
  if (to) return `Hasta ${formatDay(to)}`;
  return undefined;
}

function CategoryBreakdown({ stats }: { stats: ExpenseStatsOut }) {
  const max = Math.max(...stats.by_category.map((row) => Number(row.total)), 0);
  if (stats.by_category.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>;
  }
  return (
    <ul className="grid gap-2">
      {stats.by_category.map((row) => (
        <li key={row.category} className="grid gap-1">
          <div className="flex justify-between gap-2 text-sm">
            <span>
              {EXPENSE_CATEGORY_LABELS[row.category]}{" "}
              <span className="text-muted-foreground">({row.count})</span>
            </span>
            <span className="tabular font-medium">{formatMoney(row.total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${max > 0 ? (Number(row.total) / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ExpenseStats({ period }: { period: PeriodQuery }) {
  const stats = useExpenseStats(period);

  if (stats.isError) return <QueryError error={stats.error} onRetry={() => stats.refetch()} />;
  const data = stats.data;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4">
        <StatCard
          label="Total del período"
          value={data ? formatMoney(data.total) : undefined}
          icon={ReceiptText}
          hint={data ? [pluralize(data.count, "gasto", "gastos"), periodHint(data)].filter(Boolean).join(" · ") : undefined}
        />
        <StatCard
          label="Anomalías sin revisar"
          value={data?.anomalies_pending}
          icon={AlertTriangle}
          tone={data && data.anomalies_pending > 0 ? "warning" : "neutral"}
          hint="De cualquier fecha"
        />
      </div>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Por categoría</CardTitle>
        </CardHeader>
        <CardContent>{data ? <CategoryBreakdown stats={data} /> : <Skeleton className="h-32 w-full" />}</CardContent>
      </Card>
    </div>
  );
}
