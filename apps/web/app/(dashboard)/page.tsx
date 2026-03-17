"use client";
// apps/web/app/(dashboard)/page.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, DollarSign, Users, TrendingUp, AlertTriangle, Package } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Confirmada", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending:   { label: "Pendiente",  classes: "bg-amber-50  text-amber-700  border-amber-200"   },
  cancelled: { label: "Cancelada",  classes: "bg-gray-100  text-gray-500   border-gray-200"    },
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
      </div>
      <div className="mt-4 h-8 w-32 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetch(`${API}/api/v1/dashboard/kpis`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.clear();
          router.push("/login");
          throw new Error("Sesión expirada");
        }
        if (!r.ok) throw new Error("Error al cargar datos");
        return r.json();
      })
      .then(setKpis)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const KPI_CARDS = kpis ? [
    {
      label: "Reservas hoy",
      value: String(kpis.reservations_today),
      delta: kpis.reservations_today_delta >= 0
        ? `+${kpis.reservations_today_delta} vs ayer`
        : `${kpis.reservations_today_delta} vs ayer`,
      positive: kpis.reservations_today_delta >= 0,
      icon: Calendar, color: "text-blue-500", bg: "bg-blue-50",
    },
    {
      label: "Ingresos del mes",
      value: fmt(kpis.revenue_this_month),
      delta: kpis.revenue_delta_pct !== 0
        ? `${kpis.revenue_delta_pct > 0 ? "+" : ""}${kpis.revenue_delta_pct.toFixed(0)}% vs mes anterior`
        : "Sin datos mes anterior",
      positive: kpis.revenue_delta_pct >= 0,
      icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50",
    },
    {
      label: "Socios activos",
      value: String(kpis.active_members),
      delta: `+${kpis.new_members_this_month} este mes`,
      positive: true,
      icon: Users, color: "text-violet-500", bg: "bg-violet-50",
    },
    {
      label: "Gastos del mes",
      value: fmt(kpis.expenses_this_month),
      delta: kpis.anomalies_pending > 0
        ? `${kpis.anomalies_pending} anomalía${kpis.anomalies_pending > 1 ? "s" : ""}`
        : "Sin anomalías",
      positive: kpis.anomalies_pending === 0,
      icon: DollarSign, color: "text-amber-500", bg: "bg-amber-50",
      warn: kpis.anomalies_pending > 0,
    },
  ] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Resumen</h1>
        <p className="mt-0.5 text-sm text-gray-400 capitalize">{today}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : KPI_CARDS.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border p-5 ${
                  card.warn ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {card.label}
                  </span>
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className={`mt-4 text-2xl font-semibold tabular ${card.warn ? "text-amber-700" : "text-gray-900"}`}>
                  {card.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${card.positive ? "text-emerald-600" : "text-amber-600"}`}>
                  {card.delta}
                </p>
              </div>
            ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reservas recientes */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Reservas recientes</h2>
            <a href="/reservations" className="text-xs text-gray-400 hover:text-gray-600 transition">
              Ver todas →
            </a>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3.5">
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-100 mb-1" />
                        <div className="h-3 w-24 animate-pulse rounded bg-gray-50" />
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100 ml-auto" />
                      </td>
                    </tr>
                  ))
                : kpis?.recent_reservations?.map((r: any) => {
                    const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-gray-900">{r.member_name}</p>
                          <p className="text-xs text-gray-400">{r.court_name}</p>
                        </td>
                        <td className="px-6 py-3.5 tabular text-sm text-gray-500">
                          {r.starts_at}–{r.ends_at}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.classes}`}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {kpis?.anomalies_pending > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {kpis.anomalies_pending} anomalía{kpis.anomalies_pending > 1 ? "s" : ""} en gastos
                  </p>
                  <p className="mt-1 text-xs text-amber-600">Requieren revisión manual.</p>
                  <a href="/expenses?filter=anomalies"
                    className="mt-3 inline-block text-xs font-medium text-amber-700 underline underline-offset-2">
                    Revisar ahora →
                  </a>
                </div>
              </div>
            </div>
          )}

          {!loading && kpis && (
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Este mes</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Reservas totales</p>
                  <span className="tabular text-sm font-semibold text-gray-900">
                    {kpis.reservations_this_month}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Ingresos</p>
                  <span className="tabular text-sm font-semibold text-gray-900">
                    {fmt(kpis.revenue_this_month)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Gastos</p>
                  <span className="tabular text-sm font-semibold text-gray-900">
                    {fmt(kpis.expenses_this_month)}
                  </span>
                </div>
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Balance</p>
                  <span className={`tabular text-sm font-bold ${
                    kpis.revenue_this_month - kpis.expenses_this_month >= 0
                      ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {fmt(kpis.revenue_this_month - kpis.expenses_this_month)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
