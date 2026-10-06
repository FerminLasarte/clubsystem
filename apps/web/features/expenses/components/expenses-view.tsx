"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ExportButton } from "@/components/shared/export-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useActiveSession } from "@/features/auth/api";
import { exportExpensesCsv } from "@/features/expenses/api";
import { toFilterQuery, toPeriodQuery, useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";

import { ExpenseFiltersBar } from "./expense-filters";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpenseStats } from "./expense-stats";
import { ExpensesList } from "./expenses-list";
import { PeriodSelector } from "./period-selector";
import { RecomputeButton } from "./recompute-button";

export function ExpensesView() {
  const { permissions } = useActiveSession();
  const canWrite = permissions.includes("expenses:write");
  const { filters, setFilters } = useExpenseFilters();
  const [creating, setCreating] = useState(false);
  const period = toPeriodQuery(filters);
  const query = toFilterQuery(filters);
  const hasFilters = filters.category !== null || filters.onlyAnomalies || filters.reviewed !== "all";

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Gastos operativos del club y alertas de montos inusuales."
        actions={
          <>
            <ExportButton request={() => exportExpensesCsv(query)} filename="gastos.csv" />
            {canWrite ? (
              <>
                <RecomputeButton period={period} />
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden /> Nuevo gasto
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6">
        <PeriodSelector filters={filters} onChange={setFilters} />
        <ExpenseStats period={period} />
        <section aria-label="Listado de gastos" className="grid gap-4">
          <ExpenseFiltersBar filters={filters} onChange={setFilters} />
          <ExpensesList
            query={query}
            page={filters.page}
            onPageChange={(page) => setFilters({ page })}
            canWrite={canWrite}
            hasFilters={hasFilters}
          />
        </section>
      </div>
      {canWrite ? <ExpenseFormDialog open={creating} onOpenChange={setCreating} expense={null} /> : null}
    </>
  );
}
