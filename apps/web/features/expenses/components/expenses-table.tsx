"use client";

import type { ExpenseOut } from "@clubsystem/api";
import { ANOMALY_SEVERITY_LABELS, EXPENSE_CATEGORY_LABELS, formatDay, formatMoney } from "@clubsystem/shared";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AnomalyBadge } from "./anomaly-badge";

interface ExpensesTableProps {
  expenses: ExpenseOut[];
  canWrite: boolean;
  onOpenAnomaly: (expense: ExpenseOut) => void;
  onEdit: (expense: ExpenseOut) => void;
  onDelete: (expense: ExpenseOut) => void;
}

export function ExpensesTable({ expenses, canWrite, onOpenAnomaly, onEdit, onDelete }: ExpensesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Proveedor</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Anomalía</TableHead>
          {canWrite ? (
            <TableHead className="w-20">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell className="tabular whitespace-nowrap">{formatDay(expense.expense_date)}</TableCell>
            <TableCell>
              <Badge variant="secondary">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge>
            </TableCell>
            <TableCell className="max-w-72 truncate" title={expense.description}>
              {expense.description}
            </TableCell>
            <TableCell className="text-muted-foreground">{expense.vendor_name ?? "—"}</TableCell>
            <TableCell className="tabular text-right font-medium">{formatMoney(expense.amount)}</TableCell>
            <TableCell>
              {expense.anomaly_severity ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-auto p-1"
                  aria-label={`Anomalía ${ANOMALY_SEVERITY_LABELS[expense.anomaly_severity].toLowerCase()}${expense.reviewed_at ? " (revisada)" : ""}: ver detalle`}
                  onClick={() => onOpenAnomaly(expense)}
                >
                  <AnomalyBadge severity={expense.anomaly_severity} reviewed={expense.reviewed_at !== null} />
                </Button>
              ) : null}
            </TableCell>
            {canWrite ? (
              <TableCell className="whitespace-nowrap">
                <Button variant="ghost" size="icon" aria-label={`Editar "${expense.description}"`} onClick={() => onEdit(expense)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar "${expense.description}"`}
                  onClick={() => onDelete(expense)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
