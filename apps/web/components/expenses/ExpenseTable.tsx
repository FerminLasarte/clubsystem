"use client";
// apps/web/components/expenses/ExpenseTable.tsx
// Reusable table — used by expenses/page.tsx and anywhere else

import type { Expense } from "@ClubSystem/types";
import { AnomalyBadge } from "./AnomalyBadge";

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento",
  utilities:   "Servicios",
  salaries:    "Salarios",
  equipment:   "Equipamiento",
  marketing:   "Marketing",
  supplies:    "Insumos",
  other:       "Otros",
};

interface ExpenseTableProps {
  expenses: Expense[];
  onRowClick?: (expense: Expense) => void;
  loading?: boolean;
}

export function ExpenseTable({
  expenses,
  onRowClick,
  loading = false,
}: ExpenseTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-400">Sin gastos registrados</p>
        <p className="mt-1 text-xs text-gray-300">
          Los gastos que agregues aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {["Fecha", "Descripción", "Categoría", "Proveedor", "Monto", "Estado"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                    i === 4 ? "text-right" : i === 5 ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              onClick={() => onRowClick?.(expense)}
              className={`group transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
              }`}
            >
              <td className="px-6 py-4 tabular text-gray-400 text-xs">
                {new Date(expense.expenseDate).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-6 py-4">
                <span className="font-medium text-gray-900 line-clamp-1">
                  {expense.description}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {CATEGORY_LABELS[expense.category] ?? expense.category}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-500">
                {expense.vendorName ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-6 py-4 text-right tabular font-medium text-gray-900">
                {expense.currency}{" "}
                {Number(expense.amount).toLocaleString("es-AR", {
                  minimumFractionDigits: 0,
                })}
              </td>
              <td className="px-6 py-4 text-center">
                <AnomalyBadge
                  severity={expense.anomalySeverity}
                  reason={expense.anomalyReason}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
