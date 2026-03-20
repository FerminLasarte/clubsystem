"use client";
// apps/web/app/(dashboard)/expenses/page.tsx
//
// Gestión de gastos operativos del club.
//
// Datos:    expensesApi (GET /expenses, GET /expenses/stats, POST, PUT, DELETE, /export/csv)
// Sesión:   useClubSession() → activeClub
// Tipos:    ExpenseOut, ExpenseCreate, ExpenseUpdate, ExpenseStats (de lib/api.ts)
//
// Flujos:
//  · Crear gasto   → botón "Nuevo gasto" → modal → POST → prepend local
//  · Editar gasto  → botón ✏ → modal pre-relleno → PUT → actualiza fila
//  · Eliminar      → botón 🗑 → confirmación inline → DELETE → elimina de lista
//  · Exportar CSV  → dropdown Día/Mes/Año → GET /export/csv → descarga automática
//  · Ver anomalía  → click en badge → AnomalyModal → PATCH /review opcional

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bot,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";

import { useClubSession } from "@/contexts/ClubSessionContext";
import {
  expensesApi,
  type ExpenseCreate,
  type ExpenseOut,
  type ExpenseStats,
  type ExpenseUpdate,
} from "@/lib/api";

// ── Category catalogue ─────────────────────────────────────────────────────

interface CategoryConfig {
  label:   string;
  badgeCls: string;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  maintenance: { label: "Mantenimiento", badgeCls: "border-orange-200 bg-orange-50 text-orange-700"  },
  utilities:   { label: "Servicios",     badgeCls: "border-blue-200 bg-blue-50 text-blue-700"        },
  salaries:    { label: "Sueldos",       badgeCls: "border-violet-200 bg-violet-50 text-violet-700"  },
  equipment:   { label: "Equipamiento",  badgeCls: "border-slate-200 bg-slate-50 text-slate-600"     },
  marketing:   { label: "Marketing",     badgeCls: "border-pink-200 bg-pink-50 text-pink-700"        },
  supplies:    { label: "Insumos",       badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  other:       { label: "Otros",         badgeCls: "border-gray-200 bg-gray-50 text-gray-600"        },
};

const ANOMALY_CONFIG: Record<string, { label: string; cls: string; bg: string; icon: string }> = {
  low:      { label: "Baja",    cls: "border-yellow-200 bg-yellow-50 text-yellow-700",  bg: "bg-yellow-50 border-yellow-200",  icon: "text-yellow-500" },
  medium:   { label: "Media",   cls: "border-orange-200 bg-orange-50 text-orange-700",  bg: "bg-orange-50 border-orange-200",  icon: "text-orange-500" },
  high:     { label: "Alta",    cls: "border-red-200 bg-red-50 text-red-700",            bg: "bg-red-50 border-red-200",        icon: "text-red-500"    },
  critical: { label: "Crítica", cls: "border-red-300 bg-red-100 text-red-800",           bg: "bg-red-100 border-red-300",       icon: "text-red-600"    },
};

// ── Types ──────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; expense: ExpenseOut }
  | null;

type ToastState = { message: string; type: "success" | "error" } | null;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  // "YYYY-MM-DD" → add noon UTC to avoid off-by-one from timezone
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(amount: number, currency = "ARS"): string {
  return `${currency} ${Math.round(amount).toLocaleString("es-AR")}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr>
      {[80, 90, 200, 120, 90, 70, 88].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function StatCard({
  label, icon: Icon, value, sub, warn = false,
}: {
  label: string;
  icon:  React.ElementType;
  value: React.ReactNode;
  sub?:  string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${warn ? "border-orange-100 bg-orange-50" : "border-gray-100 bg-white"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium uppercase tracking-wide ${warn ? "text-orange-600" : "text-gray-400"}`}>
          {label}
        </p>
        <div className={`rounded-lg p-2 ${warn ? "bg-orange-100" : "bg-gray-50"}`}>
          <Icon className={`h-4 w-4 ${warn ? "text-orange-600" : "text-gray-400"}`} />
        </div>
      </div>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${warn ? "text-orange-700" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && (
        <p className={`mt-1 text-xs ${warn ? "text-orange-600" : "text-gray-400"}`}>{sub}</p>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORIES[category];
  if (!cfg) return <span className="text-xs text-gray-400">{category}</span>;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cfg.badgeCls}`}>
      {cfg.label}
    </span>
  );
}

function AnomalyBadge({
  severity, reason, reviewed, onClick,
}: {
  severity: string | null;
  reason:   string | null;
  reviewed: boolean;
  onClick?: () => void;
}) {
  if (!severity) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400">
        <CheckCircle className="h-2.5 w-2.5 text-gray-300" /> OK
      </span>
    );
  }
  const cfg = ANOMALY_CONFIG[severity];
  return (
    <button
      onClick={onClick}
      title={reason ?? "Ver detalle"}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition hover:shadow-sm ${
        reviewed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : cfg.cls
      }`}
    >
      {reviewed
        ? <><ShieldCheck className="h-2.5 w-2.5" /> Revisado</>
        : <><AlertTriangle className="h-2.5 w-2.5" /> {cfg.label}</>}
    </button>
  );
}

// ── AnomalyModal ───────────────────────────────────────────────────────────

function AnomalyModal({
  expense, open, onClose, onMarkReviewed, markingReviewed,
}: {
  expense:         ExpenseOut | null;
  open:            boolean;
  onClose:         () => void;
  onMarkReviewed:  (id: string) => void;
  markingReviewed: boolean;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!expense) return null;
  const cfg        = expense.anomaly_severity ? ANOMALY_CONFIG[expense.anomaly_severity] : null;
  const isReviewed = !!expense.reviewed_at;

  function DetailItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {icon}{label}
        </div>
        <p className="text-sm text-gray-700">{children}</p>
      </div>
    );
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div className={`relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${open ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"}`}>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 border ${cfg?.bg ?? "bg-gray-50 border-gray-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${cfg?.icon ?? "text-gray-400"}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Detalle de anomalía</h2>
              <p className="text-xs text-gray-400">
                Severidad: <span className={`font-medium ${cfg?.icon ?? "text-gray-500"}`}>{cfg?.label ?? "—"}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Score bar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <BarChart3 className="h-3.5 w-3.5" /> Score de anomalía
              </span>
              <span className="tabular-nums text-sm font-bold text-gray-900">
                {((expense.anomaly_score ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (expense.anomaly_score ?? 0) >= 0.9 ? "bg-red-500"
                  : (expense.anomaly_score ?? 0) >= 0.75 ? "bg-red-400"
                  : (expense.anomaly_score ?? 0) >= 0.55 ? "bg-orange-400"
                  : "bg-yellow-400"
                }`}
                style={{ width: `${(expense.anomaly_score ?? 0) * 100}%` }}
              />
            </div>
          </div>

          {/* Expense data */}
          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Datos del gasto</h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha">{fmtDate(expense.expense_date)}</DetailItem>
              <DetailItem icon={<DollarSign className="h-3.5 w-3.5" />} label="Monto">
                <span className="font-semibold">{fmtMoney(expense.amount, expense.currency)}</span>
              </DetailItem>
              <DetailItem icon={<Tag className="h-3.5 w-3.5" />} label="Categoría">
                {CATEGORIES[expense.category]?.label ?? expense.category}
              </DetailItem>
              <DetailItem icon={<User className="h-3.5 w-3.5" />} label="Proveedor">
                {expense.vendor_name ?? "—"}
              </DetailItem>
            </div>
            <DetailItem icon={<FileText className="h-3.5 w-3.5" />} label="Descripción">
              {expense.description}
            </DetailItem>
          </div>

          {expense.anomaly_reason && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="mb-1 text-xs font-semibold text-amber-800">Detección estadística</p>
                  <p className="text-sm leading-relaxed text-amber-700">{expense.anomaly_reason}</p>
                </div>
              </div>
            </div>
          )}

          {expense.anomaly_llm_explanation && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2.5">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div>
                  <p className="mb-1 text-xs font-semibold text-blue-800">Análisis IA</p>
                  <p className="text-sm leading-relaxed text-blue-700">{expense.anomaly_llm_explanation}</p>
                </div>
              </div>
            </div>
          )}

          {isReviewed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-700">
                  Revisado el{" "}
                  {new Date(expense.reviewed_at!).toLocaleDateString("es-AR", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4">
          {!isReviewed ? (
            <button
              onClick={() => onMarkReviewed(expense.id)}
              disabled={markingReviewed}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand, #111827)" }}
            >
              {markingReviewed ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {markingReviewed ? "Marcando…" : "Marcar como revisado"}
            </button>
          ) : (
            <p className="text-center text-sm text-gray-400">Este gasto ya fue revisado</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── ExpenseFormModal ───────────────────────────────────────────────────────

interface FormState {
  category:     string;
  description:  string;
  amount:       string;
  expense_date: string;
  vendor_name:  string;
  notes:        string;
}

const EMPTY_FORM: FormState = {
  category:     "other",
  description:  "",
  amount:       "",
  expense_date: todayIso(),
  vendor_name:  "",
  notes:        "",
};

function ExpenseFormModal({
  modal, onClose, onSave,
}: {
  modal:   NonNullable<ModalState>;
  onClose: () => void;
  onSave:  (payload: ExpenseCreate | ExpenseUpdate, id?: string) => Promise<void>;
}) {
  const isEdit    = modal.mode === "edit";
  const editItem  = isEdit ? (modal as { mode: "edit"; expense: ExpenseOut }).expense : null;

  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editItem) {
      setForm({
        category:     editItem.category,
        description:  editItem.description,
        amount:       String(editItem.amount),
        expense_date: editItem.expense_date,
        vendor_name:  editItem.vendor_name ?? "",
        notes:        "",
      });
    } else {
      setForm({ ...EMPTY_FORM, expense_date: todayIso() });
    }
    setFormError(null);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [modal.mode]);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setFormError("El monto debe ser mayor a 0"); return; }

    const payload: ExpenseCreate = {
      category:     form.category,
      description:  form.description.trim(),
      amount,
      expense_date: form.expense_date,
      vendor_name:  form.vendor_name.trim() || null,
      notes:        form.notes.trim() || null,
    };

    setSaving(true);
    try {
      await onSave(payload, editItem?.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm " +
    "text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {isEdit ? "Editar gasto" : "Nuevo gasto"}
          </h2>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Categoría */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Categoría <span className="text-red-500">*</span></label>
            <select ref={firstRef} required value={form.category} onChange={set("category")} className={inputCls}>
              {Object.entries(CATEGORIES).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Descripción <span className="text-red-500">*</span></label>
            <textarea
              required
              minLength={3}
              maxLength={500}
              rows={2}
              value={form.description}
              onChange={set("description")}
              placeholder="Ej: Pago de servicio eléctrico, compra de pelotas…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Monto + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Monto ($) <span className="text-red-500">*</span></label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={set("amount")}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha <span className="text-red-500">*</span></label>
              <input
                required
                type="date"
                value={form.expense_date}
                onChange={set("expense_date")}
                className={inputCls}
              />
            </div>
          </div>

          {/* Proveedor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Proveedor <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              value={form.vendor_name}
              onChange={set("vendor_name")}
              placeholder="Nombre del proveedor o empresa"
              className={inputCls}
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Notas <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Información adicional…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isEdit ? "Guardar cambios" : "Crear gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { activeClub, isLoading: sessionLoading } = useClubSession();

  const [expenses,        setExpenses]        = useState<ExpenseOut[]>([]);
  const [stats,           setStats]           = useState<ExpenseStats | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  // UI state
  const [modal,           setModal]           = useState<ModalState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast,           setToast]           = useState<ToastState>(null);
  const [filterCategory,  setFilterCategory]  = useState<string | null>(null);
  const [filterAnomaly,   setFilterAnomaly]   = useState(false);
  const [exportOpen,      setExportOpen]      = useState(false);
  const [exporting,       setExporting]       = useState(false);

  // Anomaly drawer
  const [drawerExpense,   setDrawerExpense]   = useState<ExpenseOut | null>(null);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    setError(null);
    try {
      const [expData, statsData] = await Promise.all([
        expensesApi.list({
          ...(filterCategory ? { category: filterCategory } : {}),
          ...(filterAnomaly  ? { hasAnomaly: true }        : {}),
        }),
        expensesApi.stats(),
      ]);
      setExpenses(expData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }, [activeClub?.clubId, filterCategory, filterAnomaly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = async (payload: ExpenseCreate | ExpenseUpdate, editId?: string) => {
    if (editId) {
      const updated = await expensesApi.update(editId, payload as ExpenseUpdate);
      setExpenses((prev) => prev.map((e) => e.id === editId ? updated : e));
      expensesApi.stats().then(setStats).catch(() => {});
      showToast("Gasto actualizado");
    } else {
      const created = await expensesApi.create(payload as ExpenseCreate);
      setExpenses((prev) => [created, ...prev]);
      expensesApi.stats().then(setStats).catch(() => {});
      showToast("Gasto registrado");
    }
  };

  const handleDelete = async (expense: ExpenseOut) => {
    try {
      await expensesApi.remove(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      expensesApi.stats().then(setStats).catch(() => {});
      showToast(`Gasto eliminado`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleExport = async (period: "day" | "month" | "year") => {
    setExportOpen(false);
    setExporting(true);
    try {
      await expensesApi.exportCsv(period);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al exportar", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleMarkReviewed = async (expenseId: string) => {
    setMarkingReviewed(true);
    try {
      await expensesApi.markReviewed(expenseId);
      const now = new Date().toISOString();
      setExpenses((prev) =>
        prev.map((e) => e.id === expenseId ? { ...e, reviewed_at: now } : e),
      );
      setDrawerExpense((prev) =>
        prev?.id === expenseId ? { ...prev, reviewed_at: now } : prev,
      );
      setStats((prev) =>
        prev ? { ...prev, anomalies_pending: Math.max(0, prev.anomalies_pending - 1) } : prev,
      );
    } catch {
      showToast("Error al marcar como revisado", "error");
    } finally {
      setMarkingReviewed(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const topCategory = stats
    ? Object.entries(stats.by_category).sort((a, b) => b[1] - a[1])[0]
    : null;

  // ── Empty: sin club ────────────────────────────────────────────────────────
  if (!sessionLoading && !activeClub) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-gray-900">Gastos</h1>
        <p className="mt-8 text-center text-sm text-gray-400">No hay ningún club activo.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gastos</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {stats ? `${stats.count} gasto${stats.count !== 1 ? "s" : ""} registrado${stats.count !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
            >
              {exporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              Exportar
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                  {(["day", "month", "year"] as const).map((p, i) => (
                    <button
                      key={p}
                      onClick={() => handleExport(p)}
                      className={`w-full cursor-pointer px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition ${i === 2 ? "rounded-b-xl" : ""}`}
                    >
                      {p === "day" ? "Del día" : p === "month" ? "Del mes" : "Del año"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--color-brand, #111827)" }}
          >
            <Plus className="h-4 w-4" />
            Nuevo gasto
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total del período"
          icon={DollarSign}
          value={stats
            ? `$\u00A0${Math.round(stats.total_amount).toLocaleString("es-AR")}`
            : <div className="h-8 w-32 animate-pulse rounded bg-gray-100" />}
        />
        <StatCard
          label="Registros"
          icon={ReceiptText}
          value={stats
            ? stats.count
            : <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />}
          sub={stats ? "gastos activos" : undefined}
        />
        <StatCard
          label="Mayor categoría"
          icon={TrendingUp}
          value={topCategory
            ? (CATEGORIES[topCategory[0]]?.label ?? topCategory[0])
            : <div className="h-8 w-28 animate-pulse rounded bg-gray-100" />}
          sub={topCategory ? `$\u00A0${Math.round(topCategory[1]).toLocaleString("es-AR")}` : undefined}
        />
      </div>

      {/* Alerta anomalías */}
      {stats && stats.anomalies_pending > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {stats.anomalies_pending} anomalía{stats.anomalies_pending > 1 ? "s" : ""} pendiente{stats.anomalies_pending > 1 ? "s" : ""} de revisión
            </p>
            <p className="mt-0.5 text-xs text-orange-600">Hacé click en el badge de cada gasto para ver el detalle.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2.5">

        {/* Fila 1 — Categorías */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filterCategory === null
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            Todas
          </button>
          {Object.entries(CATEGORIES).map(([value, { label, badgeCls }]) => (
            <button
              key={value}
              onClick={() => { if (filterCategory !== value) setFilterCategory(value); }}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                filterCategory === value ? badgeCls + " ring-1 ring-inset ring-current" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Fila 2 — Filtro independiente: anomalías */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setFilterAnomaly((v) => !v)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filterAnomaly
                ? "border-orange-300 bg-orange-50 text-orange-700 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.5)]"
                : "border-dashed border-gray-300 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${filterAnomaly ? "text-orange-500" : "text-gray-400"}`} />
            Solo con anomalías
            {filterAnomaly && <X className="ml-0.5 h-3 w-3 opacity-50" />}
          </button>
          {filterAnomaly && (
            <span className="text-xs text-orange-500">
              Combiná con una categoría para filtrar más
            </span>
          )}
        </div>

      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {["Fecha", "Categoría", "Descripción", "Proveedor", "Monto", "Estado", "Acciones"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3.5 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                      i === 4 ? "text-right"
                      : i === 5 ? "text-center"
                      : i === 6 ? "text-right"
                      : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
              : expenses.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-gray-400">
                    {filterCategory
                      ? `Sin gastos en la categoría "${CATEGORIES[filterCategory]?.label}"`
                      : "No hay gastos registrados. ¡Agregá el primero!"}
                  </td>
                </tr>
              )
              : expenses.map((expense) => {
                  const isConfirming = confirmDeleteId === expense.id;
                  return (
                    <tr
                      key={expense.id}
                      className={`transition-colors ${isConfirming ? "bg-red-50" : "hover:bg-gray-50"}`}
                    >
                      {/* Fecha */}
                      <td className="px-4 py-3.5 tabular-nums text-xs text-gray-400">
                        {fmtDate(expense.expense_date)}
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3.5">
                        <CategoryBadge category={expense.category} />
                      </td>

                      {/* Descripción */}
                      <td className="px-4 py-3.5 font-medium text-gray-900">
                        {expense.description}
                      </td>

                      {/* Proveedor */}
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {expense.vendor_name ?? <span className="text-gray-200">—</span>}
                      </td>

                      {/* Monto */}
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-gray-900">
                        {fmtMoney(expense.amount, expense.currency)}
                      </td>

                      {/* Estado / Anomalía */}
                      <td className="px-4 py-3.5 text-center">
                        <AnomalyBadge
                          severity={expense.anomaly_severity}
                          reason={expense.anomaly_reason}
                          reviewed={!!expense.reviewed_at}
                          onClick={expense.anomaly_severity ? () => {
                            setDrawerExpense(expense);
                            setDrawerOpen(true);
                          } : undefined}
                        />
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5">
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-red-600">¿Eliminar?</span>
                            <button
                              onClick={() => handleDelete(expense)}
                              className="cursor-pointer rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition"
                            >Sí</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
                            >No</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModal({ mode: "edit", expense })}
                              title="Editar gasto"
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 transition"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(expense.id)}
                              title="Eliminar gasto"
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {expenses.length > 0 && (
          <div className="border-t border-gray-50 px-6 py-3">
            <p className="text-xs text-gray-400">
              {expenses.length} gasto{expenses.length !== 1 ? "s" : ""}
              {stats ? ` · Total: $\u00A0${Math.round(stats.total_amount).toLocaleString("es-AR")} ARS` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <ExpenseFormModal
          modal={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Anomaly detail modal */}
      <AnomalyModal
        expense={drawerExpense}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setTimeout(() => setDrawerExpense(null), 300);
        }}
        onMarkReviewed={handleMarkReviewed}
        markingReviewed={markingReviewed}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="h-4 w-4 text-emerald-500" />
            : <AlertCircle className="h-4 w-4 text-red-500" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
