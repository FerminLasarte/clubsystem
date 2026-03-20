// apps/web/app/(dashboard)/cash/components/SummaryCards.tsx
// Tarjetas de resumen financiero diario: Ingresos, Egresos, Balance neto.

import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import type { DailySummary } from "@/lib/api";

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO:      "Efectivo",
  TARJETA:       "Tarjeta",
  TRANSFERENCIA: "Transf.",
  MERCADOPAGO:   "MercadoPago",
};

const METHOD_COLORS: Record<string, string> = {
  EFECTIVO:      "bg-emerald-100 text-emerald-700",
  TARJETA:       "bg-blue-100 text-blue-700",
  TRANSFERENCIA: "bg-violet-100 text-violet-700",
  MERCADOPAGO:   "bg-cyan-100 text-cyan-700",
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
      </div>
      <div className="mt-3 h-8 w-32 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  summary: DailySummary | null;
  loading: boolean;
}

export function SummaryCards({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const isPositive = summary.net_balance >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Ingresos */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              Ingresos
            </p>
            <div className="rounded-lg bg-emerald-100 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-700">
            ${fmt(summary.total_income)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">cobros del día</p>
        </div>

        {/* Egresos */}
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600">
              Egresos
            </p>
            <div className="rounded-lg bg-red-100 p-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-red-700">
            ${fmt(summary.total_expenses)}
          </p>
          <p className="mt-1 text-xs text-red-600">gastos del día</p>
        </div>

        {/* Balance neto */}
        <div
          className={`rounded-xl border p-5 ${
            isPositive
              ? "border-blue-100 bg-blue-50"
              : "border-orange-100 bg-orange-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                isPositive ? "text-blue-600" : "text-orange-600"
              }`}
            >
              Balance neto
            </p>
            <div
              className={`rounded-lg p-2 ${
                isPositive ? "bg-blue-100" : "bg-orange-100"
              }`}
            >
              <Scale
                className={`h-4 w-4 ${
                  isPositive ? "text-blue-600" : "text-orange-600"
                }`}
              />
            </div>
          </div>
          <p
            className={`mt-3 text-3xl font-bold tabular-nums ${
              isPositive ? "text-blue-700" : "text-orange-700"
            }`}
          >
            {isPositive ? "+" : ""}${fmt(summary.net_balance)}
          </p>
          <p
            className={`mt-1 text-xs ${
              isPositive ? "text-blue-600" : "text-orange-600"
            }`}
          >
            {isPositive ? "superávit" : "déficit"} del día
          </p>
        </div>
      </div>

      {/* Desglose por método de pago */}
      {Object.keys(summary.income_by_method).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.income_by_method).map(([method, total]) => (
            <span
              key={method}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                METHOD_COLORS[method] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {METHOD_LABELS[method] ?? method}
              <span className="font-semibold tabular-nums">${fmt(total)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
