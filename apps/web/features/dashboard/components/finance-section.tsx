"use client";

import { formatMoney, monthLabel } from "@clubsystem/shared";
import { Banknote, Receipt, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { QueryError } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardFinance } from "@/features/dashboard/api";

import { FinanceChart } from "./finance-chart";

/** Finanzas del mes en curso y evolución de los últimos 6 meses (rol con `dashboard:finance`). */
export function FinanceSection() {
  const finance = useDashboardFinance();
  if (finance.isError) return <QueryError error={finance.error} onRetry={() => finance.refetch()} />;
  const data = finance.data;
  const current = data?.current;
  const fees = data?.fees;

  return (
    <section aria-labelledby="finance-title" className="grid gap-4">
      <h2 id="finance-title" className="text-lg font-semibold">
        {current ? `Finanzas de ${monthLabel(current.year, current.month)}` : "Finanzas del mes"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Resultado"
          value={current && formatMoney(current.result)}
          hint="Ingresos − gastos"
          icon={Scale}
          tone="info"
        />
        <StatCard
          label="Caja"
          value={current && formatMoney(current.cash_balance)}
          hint="Ingresos − egresos de caja"
          icon={Wallet}
          tone="info"
        />
        <StatCard label="Ingresos" value={current && formatMoney(current.income)} icon={TrendingUp} tone="success" />
        <StatCard label="Gastos" value={current && formatMoney(current.expenses)} icon={Receipt} tone="danger" />
        <StatCard
          label="Egresos de caja"
          value={current && formatMoney(current.cash_outflow)}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label="Cuotas cobradas"
          value={fees && formatMoney(fees.collected.amount)}
          hint={fees && `${fees.collected.count} de ${fees.issued.count} · pendiente ${formatMoney(fees.pending.amount)}`}
          icon={Banknote}
          tone="success"
        />
      </div>
      {data ? <FinanceChart series={data.series} /> : <Skeleton className="h-72 w-full" />}
    </section>
  );
}
