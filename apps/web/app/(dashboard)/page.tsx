"use client";
// apps/web/app/(dashboard)/page.tsx
//
// Dashboard principal del panel de administración.
//
// Vistas:
//   OWNER                    → Dashboard gerencial completo (KPIs + chart + reservas)
//   Multi-rol no-OWNER       → WelcomeView con accesos rápidos
//   Solo RESERVATIONS_MANAGER → redirect /reservations
//   Solo STOCK_MANAGER        → redirect /stock
//
// Datos (OWNER):  GET /api/v1/dashboard/summary  + GET /api/v1/dashboard/kpis
// Datos (resto):  GET /api/v1/dashboard/kpis
// Sesión:        useClubSession() → activeClub, activeRoles

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, DollarSign, Users, TrendingUp,
  AlertTriangle, Package, TrendingDown, BarChart2,
} from "lucide-react";

import { useClubSession }                                         from "@/contexts/ClubSessionContext";
import { dashboardApi, type DashboardKPIs, type ManagerSummary } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$\u00A0" + Math.round(n).toLocaleString("es-AR");
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

// ── Status config reservas ────────────────────────────────────────────────────

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

// ── IncomeExpensesChart (Tailwind progress bars, sin recharts) ────────────────

function IncomeExpensesChart({ income, expenses }: { income: number; expenses: number }) {
  const total     = income + expenses;
  const incomePct  = pct(income,   total);
  const expensePct = pct(expenses, total);
  const profit     = income - expenses;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Ingresos vs Egresos</h3>
        <span className="ml-auto text-xs text-gray-400">este mes</span>
      </div>

      <div className="space-y-3">
        {/* Ingresos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Ingresos</span>
            <span className="text-xs font-semibold tabular-nums text-emerald-700">{fmt(income)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${incomePct}%` }}
            />
          </div>
        </div>

        {/* Egresos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Egresos</span>
            <span className="text-xs font-semibold tabular-nums text-red-600">{fmt(expenses)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${expensePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="mt-4 border-t border-gray-50 pt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Ganancia neta</span>
        <span
          className={`text-sm font-bold tabular-nums ${
            profit >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {profit >= 0 ? "+" : ""}{fmt(profit)}
        </span>
      </div>
    </div>
  );
}

// ── WelcomeView (multi-rol no-OWNER) ─────────────────────────────────────────

function WelcomeView({ clubName }: { clubName: string }) {
  const links = [
    { href: "/reservations", label: "Reservas",       desc: "Gestionar turnos y canchas",  color: "text-blue-500",    bg: "bg-blue-50"    },
    { href: "/members",      label: "Socios",          desc: "Ver y editar socios",          color: "text-violet-500",  bg: "bg-violet-50"  },
    { href: "/expenses",     label: "Gastos",          desc: "Egresos operativos del club",  color: "text-amber-500",   bg: "bg-amber-50"   },
    { href: "/cash",         label: "Caja Diaria",     desc: "Cobros y retiros",             color: "text-emerald-500", bg: "bg-emerald-50" },
    { href: "/stock",        label: "Stock",           desc: "Inventario y productos",       color: "text-cyan-500",    bg: "bg-cyan-50"    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Bienvenido</h1>
        <p className="mt-0.5 text-sm text-gray-400">{clubName}</p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white px-8 py-10">
        <p className="text-sm font-medium text-gray-700 mb-6">Accesos rápidos</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 text-center hover:border-gray-200 hover:shadow-sm transition-all"
            >
              <div className={`rounded-lg p-2.5 ${l.bg}`}>
                <Package className={`h-5 w-5 ${l.color}`} />
              </div>
              <span className="text-xs font-semibold text-gray-800">{l.label}</span>
              <span className="text-xs text-gray-400 leading-tight">{l.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router              = useRouter();
  const { activeClub, activeRoles } = useClubSession();

  const [kpis,    setKpis]    = useState<DashboardKPIs | null>(null);
  const [summary, setSummary] = useState<ManagerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isOwner = activeRoles?.includes("OWNER") ?? false;

  // ── Redirect para roles únicos ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoles || activeRoles.length !== 1) return;
    const [role] = activeRoles;
    if (role === "RESERVATIONS_MANAGER") router.replace("/reservations");
    if (role === "STOCK_MANAGER")        router.replace("/stock");
  }, [activeRoles, router]);

  // ── Fetch de datos ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeClub) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);
    setKpis(null);
    setSummary(null);

    const fetches = isOwner
      ? Promise.all([dashboardApi.kpis(), dashboardApi.summary()])
      : Promise.all([dashboardApi.kpis(), Promise.resolve(null)]);

    fetches
      .then(([kpisData, summaryData]) => {
        if (cancelled) return;
        setKpis(kpisData);
        setSummary(summaryData);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeClub?.clubId, isOwner]);

  // ── Fecha ──────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  // ── Sin club ───────────────────────────────────────────────────────────────
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

  // ── Multi-rol no-OWNER → WelcomeView ───────────────────────────────────────
  if (!loading && activeClub && !isOwner) {
    return <WelcomeView clubName={activeClub.clubName ?? activeClub.clubId} />;
  }

  // ── KPI cards (OWNER) ──────────────────────────────────────────────────────
  const netProfit = summary?.net_profit ?? (kpis ? kpis.revenue_this_month - kpis.expenses_this_month : 0);

  const kpiCards = [
    {
      label:    "Socios activos",
      value:    summary ? String(summary.total_members) : (kpis ? String(kpis.active_members) : "—"),
      delta:    kpis ? `+${kpis.new_members_this_month} este mes` : "",
      positive: true,
      icon:     Users,
      color:    "text-violet-500",
      bg:       "bg-violet-50",
      warn:     false,
    },
    {
      label:    "Reservas hoy",
      value:    summary ? String(summary.today_reservations) : (kpis ? String(kpis.reservations_today) : "—"),
      delta:    kpis
                  ? (kpis.reservations_today_delta >= 0
                      ? `+${kpis.reservations_today_delta} vs ayer`
                      : `${kpis.reservations_today_delta} vs ayer`)
                  : "",
      positive: (kpis?.reservations_today_delta ?? 0) >= 0,
      icon:     Calendar,
      color:    "text-blue-500",
      bg:       "bg-blue-50",
      warn:     false,
    },
    {
      label:    "Ingresos del mes",
      value:    summary ? fmt(summary.monthly_income) : (kpis ? fmt(kpis.revenue_this_month) : "—"),
      delta:    kpis?.revenue_delta_pct != null
                  ? (kpis.revenue_delta_pct !== 0
                      ? `${kpis.revenue_delta_pct > 0 ? "+" : ""}${kpis.revenue_delta_pct.toFixed(0)}% vs mes anterior`
                      : "Sin datos mes anterior")
                  : "",
      positive: (kpis?.revenue_delta_pct ?? 0) >= 0,
      icon:     TrendingUp,
      color:    "text-emerald-500",
      bg:       "bg-emerald-50",
      warn:     false,
    },
    {
      label:    "Ganancia neta",
      value:    loading ? "—" : fmt(netProfit),
      delta:    summary
                  ? `Egresos: ${fmt(summary.monthly_expenses)}`
                  : (kpis ? `Egresos: ${fmt(kpis.expenses_this_month)}` : ""),
      positive: netProfit >= 0,
      icon:     netProfit >= 0 ? TrendingUp : TrendingDown,
      color:    netProfit >= 0 ? "text-emerald-500" : "text-red-500",
      bg:       netProfit >= 0 ? "bg-emerald-50"   : "bg-red-50",
      warn:     netProfit < 0,
    },
  ];

  const monthlyIncome   = summary?.monthly_income   ?? kpis?.revenue_this_month   ?? 0;
  const monthlyExpenses = summary?.monthly_expenses ?? kpis?.expenses_this_month  ?? 0;

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpiCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border p-5 ${
                  card.warn ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
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
                <p className={`mt-4 text-2xl font-semibold tabular-nums ${
                  card.warn ? "text-red-700" : "text-gray-900"
                }`}>
                  {card.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${
                  card.positive ? "text-emerald-600" : "text-red-500"
                }`}>
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
                : (kpis?.recent_reservations ?? []).map((r) => {
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
              {!loading && (kpis?.recent_reservations ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-400">
                    No hay reservas recientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">

          {/* Gráfico ingresos vs egresos */}
          {!loading && (
            <IncomeExpensesChart
              income={monthlyIncome}
              expenses={monthlyExpenses}
            />
          )}

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
          {!loading && (kpis || summary) && (
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Este mes</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Reservas totales</p>
                  <span className="tabular-nums text-sm font-semibold text-gray-900">
                    {kpis?.reservations_this_month ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Ingresos</p>
                  <span className="tabular-nums text-sm font-semibold text-emerald-700">
                    {fmt(monthlyIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Egresos</p>
                  <span className="tabular-nums text-sm font-semibold text-red-600">
                    {fmt(monthlyExpenses)}
                  </span>
                </div>
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Balance</p>
                  <span className={`tabular-nums text-sm font-bold ${
                    netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {netProfit >= 0 ? "+" : ""}{fmt(netProfit)}
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
