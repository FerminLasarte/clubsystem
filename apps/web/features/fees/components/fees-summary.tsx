"use client";

import type { FeeTotals } from "@clubsystem/api";
import { formatMoney, pluralize } from "@clubsystem/shared";
import { CircleCheck, Clock, FileText } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { QueryError } from "@/components/shared/state-view";
import { useFeesSummary } from "@/features/fees/api";

function hint(totals: FeeTotals | undefined): string | undefined {
  if (!totals) return undefined;
  return pluralize(totals.count, "cuota", "cuotas");
}

/** Emitido / cobrado / pendiente del período. */
export function FeesSummaryCards({ year, month }: { year: number; month: number }) {
  const summary = useFeesSummary(year, month);
  if (summary.isError) return <QueryError error={summary.error} onRetry={() => summary.refetch()} />;
  const data = summary.data;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Emitido"
        value={data && formatMoney(data.issued.amount)}
        hint={hint(data?.issued)}
        icon={FileText}
        tone="info"
      />
      <StatCard
        label="Cobrado"
        value={data && formatMoney(data.collected.amount)}
        hint={hint(data?.collected)}
        icon={CircleCheck}
        tone="success"
      />
      <StatCard
        label="Pendiente"
        value={data && formatMoney(data.pending.amount)}
        hint={hint(data?.pending)}
        icon={Clock}
        tone="warning"
      />
    </div>
  );
}
