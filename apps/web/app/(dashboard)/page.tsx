"use client";
// apps/web/app/(dashboard)/page.tsx
//
// Pantalla principal del panel de administración.
//
// Datos:   GET /api/v1/dashboard/kpis  (via dashboardApi — typed, auth injected)
// Sesión:  useClubSession() → activeClub, activeRoles
// Tipos:   DashboardKPIs, RecentReservation (de lib/api.ts)
// Estado:  loading → skeleton | error → banner | data → cards + table

import { useEffect, useState } from "react";
import { Calendar, DollarSign, Users, TrendingUp, AlertTriangle, Package } from "lucide-react";

import { useClubSession }                      from "@/contexts/ClubSessionContext";
import { dashboardApi, type DashboardKPIs }    from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formatea un número como moneda argentina: $ 15.000 */
function fmt(n: number): string {
  return "$\u00A0" + Math.round(n).toLocaleString("es-AR");
}

// ── Status config para la tabla de reservas ───────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Confirmada", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending:   { label: "Pendiente",  classes: "bg-amber-50  text-amber-700  border-amber-200"   },
  cancelled: { label: "Cancelada",  classes: "bg-gray-100  text-gray-500   border-gray-200"    },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

// ── KPI card config builder ───────────────────────────────────────────────────

function buildKpiCards(kpis: DashboardKPIs) {
  return [
    {
      label:    "Reservas hoy",
      value:    String(kpis.reservations_today),
      delta:    kpis.reservations_today_delta >= 0
                  ? `+${kpis.reservations_today_delta} vs ayer`
                  : `${kpis.reservations_today_delta} vs ayer`,
      positive: kpis.reservations_today_delta >= 0,
      icon:     Calendar,
      color:    "text-blue-500",
      bg:       "bg-blue-50",
      warn:     false,
    },
    {
      label:    "Ingresos del mes",
      value:    fmt(kpis.revenue_this_month),
      delta:    kpis.revenue_delta_pct !== 0
                  ? `${kpis.revenue_delta_pct > 0 ? "+" : ""}${kpis.revenue_delta_pct.toFixed(0)}% vs mes anterior`
                  : "Sin datos mes anterior",
      positive: kpis.revenue_delta_pct >= 0,
      icon:     TrendingUp,
      color:    "text-emerald-500",
      bg:       "bg-emerald-50",
      warn:     false,
    },
    {
      label:    "Socios activos",
      value:    String(kpis.active_members),
      delta:    `+${kpis.new_members_this_month} este mes`,
      positive: true,
      icon:     Users,
      color:    "text-violet-500",
      bg:       "bg-violet-50",
      warn:     false,
    },
    {
      label:    "Gastos del mes",
      value:    fmt(kpis.expenses_this_month),
      delta:    kpis.anomalies_pending > 0
                  ? `${kpis.anomalies_pending} anomalía${kpis.anomalies_pending > 1 ? "s" : ""}`
                  : "Sin anomalías",
      positive: kpis.anomalies_pending === 0,
      icon:     DollarSign,
      color:    "text-amber-500",
      bg:       "bg-amber-50",
      warn:     kpis.anomalies_pending > 0,
    },
  ] as const;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { activeClub } = useClubSession();

  const [kpis,    setKpis]    = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Re-fetch cuando cambia el club activo
  useEffect(() => {
    if (!activeClub) {
      setLoading(false);
      return;
    }

    let cancelled = false;   // evitar setState tras desmontaje

    setLoading(true);
    setError(null);
    setKpis(null);

    dashboardApi
      .kpis()
      .then((data) => { if (!cancelled) setKpis(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeClub?.clubId]);

  // ── Fecha localizada ──────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  // ── Estado vacío: sin club activo ─────────────────────────────────────────────
  if (!loading && !activeClub) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resumen</h1>
          <p className="mt-0.5 text-sm text-gray-400 capitalize">{today}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-8 py-16 text-center text-gray-400">
          <p className="text-sm">No hay ningún club activo seleccionado.</p>
        </div>
      </div>
    );
  }

  const kpiCards = kpis ? buildKpiCards(kpis) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Resumen</h1>
        <p className="mt-0.5 text-sm text-gray-400 capitalize">{today}</p>
      </div>

      {/* Banner de error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpiCards.map((card) => (
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
                <p className={`mt-4 text-2xl font-semibold tabular-nums ${card.warn ? "text-amber-700" : "text-gray-900"}`}>
                  {card.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${card.positive ? "text-emerald-600" : "text-amber-600"}`}>
                  {card.delta}
                </p>
              </div>
            ))}
      </div>

      {/* ── Two-column layout ── */}
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
                : kpis?.recent_reservations.map((r) => {
                    const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-gray-900">{r.member_name}</p>
                          <p className="text-xs text-gray-400">{r.court_name}</p>
                        </td>
                        <td className="px-6 py-3.5 tabular-nums text-sm text-gray-500">
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

        {/* Columna derecha */}
        <div className="space-y-4">

          {/* Alerta de anomalías */}
          {kpis && kpis.anomalies_pending > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {kpis.anomalies_pending} anomalía{kpis.anomalies_pending > 1 ? "s" : ""} en gastos
                  </p>
                  <p className="mt-1 text-xs text-amber-600">Requieren revisión manual.</p>
                  <a
                    href="/expenses?filter=anomalies"
                    className="mt-3 inline-block text-xs font-medium text-amber-700 underline underline-offset-2"
                  >
                    Revisar ahora →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Resumen mensual */}
          {!loading && kpis && (
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Este mes</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Reservas totales</p>
                  <span className="tabular-nums text-sm font-semibold text-gray-900">
                    {kpis.reservations_this_month}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Ingresos</p>
                  <span className="tabular-nums text-sm font-semibold text-gray-900">
                    {fmt(kpis.revenue_this_month)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Gastos</p>
                  <span className="tabular-nums text-sm font-semibold text-gray-900">
                    {fmt(kpis.expenses_this_month)}
                  </span>
                </div>
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Balance</p>
                  <span className={`tabular-nums text-sm font-bold ${
                    kpis.revenue_this_month - kpis.expenses_this_month >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
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
