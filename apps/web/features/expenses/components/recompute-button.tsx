"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRecomputeAnomalies, type PeriodQuery } from "@/features/expenses/api";

/** Recalcula la estadística (sin IA) de los gastos del período elegido. */
export function RecomputeButton({ period }: { period: PeriodQuery }) {
  const recompute = useRecomputeAnomalies();
  return (
    <Button variant="outline" disabled={recompute.isPending} onClick={() => recompute.mutate(period)}>
      <RefreshCw className={recompute.isPending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {recompute.isPending ? "Recalculando…" : "Recalcular anomalías"}
    </Button>
  );
}
