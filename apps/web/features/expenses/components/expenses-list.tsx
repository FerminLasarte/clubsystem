"use client";

import type { ExpenseOut } from "@clubsystem/api";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteExpense, useExpenses, type ExpenseFilterQuery } from "@/features/expenses/api";

import { AnomalyDialog } from "./anomaly-dialog";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpensesTable } from "./expenses-table";

const PAGE_SIZE = 25;

interface ExpensesListProps {
  query: ExpenseFilterQuery;
  page: number;
  onPageChange: (page: number) => void;
  canWrite: boolean;
  hasFilters: boolean;
}

export function ExpensesList({ query, page, onPageChange, canWrite, hasFilters }: ExpensesListProps) {
  const expenses = useExpenses({ ...query, page, page_size: PAGE_SIZE });
  const remove = useDeleteExpense();
  const [anomalyOf, setAnomalyOf] = useState<ExpenseOut | null>(null);
  const [editing, setEditing] = useState<ExpenseOut | null>(null);
  const [deleting, setDeleting] = useState<ExpenseOut | null>(null);

  return (
    <Card>
      <CardContent>
        {expenses.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : expenses.isError ? (
          <QueryError error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : expenses.data.items.length === 0 ? (
          <StateView
            variant="empty"
            title="No hay gastos"
            description={hasFilters ? "Probá con otros filtros o con otro período." : "No se registraron gastos en este período."}
            action={page > 1 ? { label: "Volver a la primera página", onClick: () => onPageChange(1) } : undefined}
          />
        ) : (
          <>
            <ExpensesTable
              expenses={expenses.data.items}
              canWrite={canWrite}
              onOpenAnomaly={setAnomalyOf}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
            <Pagination
              page={expenses.data.page}
              pageSize={expenses.data.page_size}
              total={expenses.data.total}
              onPageChange={onPageChange}
            />
          </>
        )}
      </CardContent>
      <AnomalyDialog expense={anomalyOf} canWrite={canWrite} onClose={() => setAnomalyOf(null)} />
      <ExpenseFormDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} expense={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar gasto"
        description={deleting ? `"${deleting.description}" dejará de figurar en los listados y los totales.` : undefined}
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </Card>
  );
}
