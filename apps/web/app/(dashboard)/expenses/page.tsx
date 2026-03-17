"use client";
// apps/web/app/(dashboard)/expenses/page.tsx

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle,
  X,
  ShieldCheck,
  Bot,
  BarChart3,
  Calendar,
  Tag,
  User,
  FileText,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento",
  utilities:   "Servicios",
  salaries:    "Salarios",
  equipment:   "Equipamiento",
  marketing:   "Marketing",
  supplies:    "Insumos",
  other:       "Otros",
};

const ANOMALY_CONFIG: Record<string, { label: string; classes: string; drawerBg: string; iconColor: string }> = {
  low:      { label: "Baja",    classes: "bg-yellow-50 text-yellow-600 border-yellow-200",  drawerBg: "bg-yellow-50 border-yellow-200",  iconColor: "text-yellow-500" },
  medium:   { label: "Media",   classes: "bg-orange-50 text-orange-600 border-orange-200",  drawerBg: "bg-orange-50 border-orange-200",  iconColor: "text-orange-500" },
  high:     { label: "Alta",    classes: "bg-red-50 text-red-600 border-red-200",            drawerBg: "bg-red-50 border-red-200",        iconColor: "text-red-500"    },
  critical: { label: "Crítica", classes: "bg-red-100 text-red-700 border-red-300",           drawerBg: "bg-red-100 border-red-300",       iconColor: "text-red-600"    },
};

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  vendor_name: string | null;
  anomaly_score: number | null;
  anomaly_severity: string | null;
  anomaly_reason: string | null;
  anomaly_llm_explanation: string | null;
  reviewed_at: string | null;
}

interface Stats {
  total_amount: number;
  count: number;
  by_category: Record<string, number>;
  anomalies_pending: number;
}

function RowSkeleton() {
  return (
    <tr>
      {[60,200,100,120,80,60].map((w,i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function AnomalyBadge({
  severity,
  reason,
  reviewed,
  onClick,
}: {
  severity: string | null;
  reason: string | null;
  reviewed: boolean;
  onClick?: () => void;
}) {
  if (!severity) {
    return <CheckCircle className="h-4 w-4 text-gray-200 mx-auto" />;
  }
  const cfg = ANOMALY_CONFIG[severity];
  return (
    <button
      onClick={onClick}
      title={reason ?? ""}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:shadow-sm ${
        reviewed
          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
          : cfg.classes
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {reviewed ? (
        <>
          <ShieldCheck className="h-3 w-3" />
          Revisado
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3" />
          {cfg.label}
        </>
      )}
    </button>
  );
}

/* ── Anomaly Detail Modal ───────────────────────────────── */
function AnomalyModal({
  expense,
  open,
  onClose,
  onMarkReviewed,
  markingReviewed,
}: {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onMarkReviewed: (id: string) => void;
  markingReviewed: boolean;
}) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!expense) return null;

  const cfg = expense.anomaly_severity
    ? ANOMALY_CONFIG[expense.anomaly_severity]
    : null;

  const isReviewed = !!expense.reviewed_at;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Modal popup */}
      <div
        className={`relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 max-h-[90vh] ${
          open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${cfg?.drawerBg ?? "bg-gray-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${cfg?.iconColor ?? "text-gray-400"}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Detalle de anomalía</h2>
              <p className="text-xs text-gray-400">
                Severidad:{" "}
                <span className={`font-medium ${cfg?.iconColor ?? "text-gray-500"}`}>
                  {cfg?.label ?? "—"}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <BarChart3 className="h-3.5 w-3.5" />
                Score de anomalía
              </span>
              <span className="text-sm font-bold tabular text-gray-900">
                {((expense.anomaly_score ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (expense.anomaly_score ?? 0) >= 0.9
                    ? "bg-red-500"
                    : (expense.anomaly_score ?? 0) >= 0.75
                    ? "bg-red-400"
                    : (expense.anomaly_score ?? 0) >= 0.55
                    ? "bg-orange-400"
                    : "bg-yellow-400"
                }`}
                style={{ width: `${(expense.anomaly_score ?? 0) * 100}%` }}
              />
            </div>
          </div>

          {/* Expense details */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Datos del gasto
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha">
                {new Date(expense.expense_date).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </DetailItem>
              <DetailItem icon={<DollarSign className="h-3.5 w-3.5" />} label="Monto">
                <span className="font-semibold">
                  {expense.currency} {Math.round(expense.amount).toLocaleString("es-AR")}
                </span>
              </DetailItem>
              <DetailItem icon={<Tag className="h-3.5 w-3.5" />} label="Categoría">
                {CATEGORY_LABELS[expense.category] ?? expense.category}
              </DetailItem>
              <DetailItem icon={<User className="h-3.5 w-3.5" />} label="Proveedor">
                {expense.vendor_name ?? "—"}
              </DetailItem>
            </div>
            <DetailItem icon={<FileText className="h-3.5 w-3.5" />} label="Descripción">
              {expense.description}
            </DetailItem>
          </div>

          {/* Statistical reason */}
          {expense.anomaly_reason && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">Detección estadística</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    {expense.anomaly_reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* LLM explanation */}
          {expense.anomaly_llm_explanation && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2.5">
                <Bot className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-800 mb-1">Análisis IA</p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    {expense.anomaly_llm_explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Review status */}
          {isReviewed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-700">
                  Revisado el{" "}
                  {new Date(expense.reviewed_at!).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 px-6 py-4">
          {!isReviewed ? (
            <button
              onClick={() => onMarkReviewed(expense.id)}
              disabled={markingReviewed}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              <ShieldCheck className="h-4 w-4" />
              {markingReviewed ? "Marcando…" : "Marcar como revisado"}
            </button>
          ) : (
            <div className="text-center text-sm text-gray-400">
              Este gasto ya fue revisado
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(searchParams.get("filter") ?? "all");

  // Drawer state
  const [drawerExpense, setDrawerExpense] = useState<Expense | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filter === "anomalies") params.set("has_anomaly", "true");

    try {
      const [expRes, statsRes] = await Promise.all([
        fetch(`${API}/api/v1/expenses?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/v1/expenses/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!expRes.ok || !statsRes.ok) throw new Error("Error al cargar gastos");
      setExpenses(await expRes.json());
      setStats(await statsRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDrawer = (expense: Expense) => {
    setDrawerExpense(expense);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerExpense(null), 300); // wait for animation
  };

  const handleMarkReviewed = async (expenseId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setMarkingReviewed(true);
    try {
      const res = await fetch(`${API}/api/v1/expenses/${expenseId}/review`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al marcar como revisado");

      // Update local state
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expenseId ? { ...e, reviewed_at: new Date().toISOString() } : e
        )
      );
      setDrawerExpense((prev) =>
        prev && prev.id === expenseId
          ? { ...prev, reviewed_at: new Date().toISOString() }
          : prev
      );

      // Decrement pending count
      setStats((prev) =>
        prev ? { ...prev, anomalies_pending: Math.max(0, prev.anomalies_pending - 1) } : prev
      );
    } catch {
      alert("Error al marcar como revisado");
    } finally {
      setMarkingReviewed(false);
    }
  };

  const topCategory = stats
    ? Object.entries(stats.by_category).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gastos</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {stats ? `${stats.count} gasto${stats.count !== 1 ? "s" : ""} registrado${stats.count !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
        <button 
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo gasto
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Total</span>
            <DollarSign className="h-4 w-4 text-gray-300" />
          </div>
          {stats
            ? <p className="mt-3 text-2xl font-semibold text-gray-900 tabular">${Math.round(stats.total_amount).toLocaleString("es-AR")}</p>
            : <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-100" />}
        </div>

        <div className={`rounded-xl border p-5 ${stats?.anomalies_pending ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Anomalías</span>
            <AlertTriangle className={`h-4 w-4 ${stats?.anomalies_pending ? "text-amber-500" : "text-gray-300"}`} />
          </div>
          {stats
            ? <p className={`mt-3 text-2xl font-semibold tabular ${stats.anomalies_pending ? "text-amber-700" : "text-gray-900"}`}>{stats.anomalies_pending}</p>
            : <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-100" />}
          {stats && <p className="mt-1 text-xs text-gray-400">pendientes de revisión</p>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Mayor categoría</span>
            <TrendingUp className="h-4 w-4 text-gray-300" />
          </div>
          {topCategory
            ? <>
                <p className="mt-3 text-2xl font-semibold text-gray-900">{CATEGORY_LABELS[topCategory[0]] ?? topCategory[0]}</p>
                <p className="mt-1 text-xs text-gray-400">${Math.round(topCategory[1]).toLocaleString("es-AR")}</p>
              </>
            : <div className="mt-3 h-8 w-28 animate-pulse rounded bg-gray-100" />}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[{ key: "all", label: "Todos" }, { key: "anomalies", label: "Con anomalías" }].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === f.key
                ? "text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
            style={filter === f.key ? { backgroundColor: "var(--color-brand)" } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
              <tr className="border-b border-gray-50">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-left w-[12%]">Fecha</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-left w-[30%]">Descripción</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-left w-[15%]">Categoría</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-left w-[18%]">Proveedor</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-right w-[15%]">Monto</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 text-center w-[10%]">Estado</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
              : expenses.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                    {filter === "anomalies" ? "No hay anomalías pendientes" : "No hay gastos registrados"}
                  </td>
                </tr>
              )
              : expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-400 tabular w-[12%]">
                    {new Date(e.expense_date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 w-[30%]">
                    <span className="line-clamp-1" title={e.description}>{e.description}</span>
                  </td>
                  <td className="px-6 py-4 w-[15%]">
                    <span className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 truncate inline-block max-w-full">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 w-[18%] truncate">
                    {e.vendor_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right tabular font-medium text-gray-900 w-[15%]">
                    {e.currency} {Math.round(e.amount).toLocaleString("es-AR")}
                  </td>
                  <td className="px-6 py-4 text-center w-[10%]">
                    <AnomalyBadge
                      severity={e.anomaly_severity}
                      reason={e.anomaly_reason}
                      reviewed={!!e.reviewed_at}
                      onClick={e.anomaly_severity ? () => openDrawer(e) : undefined}
                    />
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {expenses.length > 0 && (
          <div className="border-t border-gray-50 px-6 py-3">
            <p className="text-xs text-gray-400">
              {expenses.length} gasto{expenses.length !== 1 ? "s" : ""} · Total: ${stats ? Math.round(stats.total_amount).toLocaleString("es-AR") : "…"} ARS
            </p>
          </div>
        )}
      </div>

      {/* Anomaly Modal */}
      <AnomalyModal
        expense={drawerExpense}
        open={drawerOpen}
        onClose={closeDrawer}
        onMarkReviewed={handleMarkReviewed}
        markingReviewed={markingReviewed}
      />
    </div>
  );
}
