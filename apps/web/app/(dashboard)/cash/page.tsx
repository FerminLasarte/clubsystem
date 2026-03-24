"use client";
// apps/web/app/(dashboard)/cash/page.tsx
//
// Módulo de Cobros y Caja Diaria.
//
// Datos:    paymentsApi + financeApi
// Sesión:   useClubSession()
// Tipos:    PaymentOut, PaymentCreate, DailySummary, MemberOut
//
// Flujos:
//  · Navegar día      → ‹ input[date] › + "Hoy" → refetch resumen + cobros
//  · Registrar cobro  → botón "Registrar cobro" → modal INCOME → POST → refetch
//  · Retiro / vale    → botón rojo "Retiro" → modal OUTFLOW → POST → refetch
//  · Eliminar         → botón 🗑 → confirmación inline → DELETE → refetch

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { PageHeader }   from "@/components/ui/page-header";
import { useClubSession } from "@/contexts/ClubSessionContext";
import {
  financeApi,
  membersApi,
  paymentsApi,
  type DailySummary,
  type MemberOut,
  type PaymentCreate,
  type PaymentOut,
} from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "EFECTIVO",      label: "Efectivo"      },
  { value: "TARJETA",       label: "Tarjeta"       },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "MERCADOPAGO",   label: "MercadoPago"   },
];

const METHOD_BADGE: Record<string, string> = {
  EFECTIVO:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  TARJETA:       "border-blue-200   bg-blue-50   text-blue-700",
  TRANSFERENCIA: "border-violet-200 bg-violet-50 text-violet-700",
  MERCADOPAGO:   "border-cyan-200   bg-cyan-50   text-cyan-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtMoney(n: number): string {
  return `$\u00A0${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtMoneyExact(n: number): string {
  return `$\u00A0${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch { return "—"; }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastState  = { message: string; type: "success" | "error" } | null;
type ModalTarget = "income" | "outflow" | null;

type CardVariant = "default" | "income" | "expense" | "outflow" | "balance-pos" | "balance-neg";

const CARD_STYLES: Record<CardVariant, {
  wrap: string; label: string; iconWrap: string; icon: string; value: string; sub: string;
}> = {
  "default": {
    wrap:     "border-gray-100 bg-white",
    label:    "text-gray-400",
    iconWrap: "bg-gray-50",
    icon:     "text-gray-400",
    value:    "text-gray-900",
    sub:      "text-gray-400",
  },
  "income": {
    wrap:     "border-emerald-100 bg-emerald-50",
    label:    "text-emerald-600",
    iconWrap: "bg-emerald-100",
    icon:     "text-emerald-600",
    value:    "text-emerald-700",
    sub:      "text-emerald-600",
  },
  "expense": {
    wrap:     "border-red-100 bg-red-50",
    label:    "text-red-600",
    iconWrap: "bg-red-100",
    icon:     "text-red-600",
    value:    "text-red-700",
    sub:      "text-red-600",
  },
  "outflow": {
    wrap:     "border-orange-100 bg-orange-50",
    label:    "text-orange-600",
    iconWrap: "bg-orange-100",
    icon:     "text-orange-600",
    value:    "text-orange-700",
    sub:      "text-orange-600",
  },
  "balance-pos": {
    wrap:     "border-blue-100 bg-blue-50",
    label:    "text-blue-600",
    iconWrap: "bg-blue-100",
    icon:     "text-blue-600",
    value:    "text-blue-700",
    sub:      "text-blue-600",
  },
  "balance-neg": {
    wrap:     "border-red-100 bg-red-50",
    label:    "text-red-600",
    iconWrap: "bg-red-100",
    icon:     "text-red-600",
    value:    "text-red-700",
    sub:      "text-red-600",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr>
      {[60, 100, 220, 110, 90, 48].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function StatCard({
  label, icon: Icon, value, sub, variant = "default",
}: {
  label:    string;
  icon:     React.ElementType;
  value:    React.ReactNode;
  sub?:     string;
  variant?: CardVariant;
}) {
  const s = CARD_STYLES[variant];
  return (
    <div className={`rounded-xl border p-5 ${s.wrap}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium uppercase tracking-wide ${s.label}`}>{label}</p>
        <div className={`rounded-lg p-2 ${s.iconWrap}`}>
          <Icon className={`h-4 w-4 ${s.icon}`} />
        </div>
      </div>
      <div className={`mt-3 text-3xl font-bold tabular-nums ${s.value}`}>{value}</div>
      {sub && <p className={`mt-1 text-xs ${s.sub}`}>{sub}</p>}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const label = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
      METHOD_BADGE[method] ?? "border-gray-200 bg-gray-50 text-gray-600"
    }`}>
      {label}
    </span>
  );
}

// ── PaymentFormModal ──────────────────────────────────────────────────────────
// Reutilizado para INCOME (cobro) y OUTFLOW (retiro/vale). El `target` determina
// el título, colores de acento y el campo transaction_type enviado al backend.

interface FormState {
  amount:      string;
  method:      string;
  description: string;
  memberId:    string;
}

const EMPTY_FORM: FormState = {
  amount:      "",
  method:      "EFECTIVO",
  description: "",
  memberId:    "",
};

function PaymentFormModal({
  target, onClose, onSave, members, saving,
}: {
  target:  "income" | "outflow";
  onClose: () => void;
  onSave:  (payload: PaymentCreate) => Promise<void>;
  members: MemberOut[];
  saving:  boolean;
}) {
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  const isOutflow = target === "outflow";

  useEffect(() => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [target]);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setFormError("El monto debe ser mayor a 0"); return; }
    if (!form.description.trim()) { setFormError("La descripción es obligatoria"); return; }

    try {
      await onSave({
        amount,
        payment_method:   form.method,
        description:      form.description.trim(),
        transaction_type: isOutflow ? "OUTFLOW" : "INCOME",
        member_id:        form.memberId || null,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm " +
    "text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition";

  const accentBtn  = isOutflow
    ? "bg-red-600 hover:bg-red-700"
    : "bg-gray-900 hover:bg-gray-700";

  const title = isOutflow ? "Registrar retiro / vale" : "Registrar cobro";
  const actionLabel = isOutflow ? "Registrar retiro" : "Registrar cobro";
  const placeholder = isOutflow
    ? "Ej: Vale combustible, retiro caja"
    : "Ej: Pago turno Cancha 1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${
          isOutflow ? "border-red-100 bg-red-50" : "border-gray-50"
        }`}>
          <div className="flex items-center gap-2">
            {isOutflow
              ? <ArrowDownLeft className="h-4 w-4 text-red-500" />
              : <ArrowUpRight  className="h-4 w-4 text-emerald-500" />}
            <h2 className={`text-sm font-semibold ${isOutflow ? "text-red-800" : "text-gray-900"}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Monto */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Monto ($) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <DollarSign className="h-3.5 w-3.5" />
              </span>
              <input
                ref={firstRef}
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={set("amount")}
                placeholder="0.00"
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>

          {/* Método */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Método <span className="text-red-500">*</span>
            </label>
            <select required value={form.method} onChange={set("method")} className={inputCls}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Descripción <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              maxLength={255}
              value={form.description}
              onChange={set("description")}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>

          {/* Socio (solo para INCOME) */}
          {!isOutflow && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Socio <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <select value={form.memberId} onChange={set("memberId")} className={inputCls}>
                <option value="">— Sin socio asociado —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}{m.member_number ? ` (#${m.member_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition ${accentBtn}`}
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isOutflow ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Guardando…" : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashPage() {
  const { activeClub, isLoading: sessionLoading } = useClubSession();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  const [summary,  setSummary]  = useState<DailySummary | null>(null);
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [members,  setMembers]  = useState<MemberOut[]>([]);

  const [loading,        setLoading]        = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const [activeModal,   setActiveModal]   = useState<ModalTarget>(null);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [toast,         setToast]         = useState<ToastState>(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (date: string) => {
    if (!activeClub) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, pmts] = await Promise.all([
        financeApi.dailySummary(date),
        paymentsApi.list(date),
      ]);
      setSummary(sum);
      setPayments(pmts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [activeClub?.clubId]);

  // ── Fetch members once ────────────────────────────────────────────────────
  useEffect(() => {
    membersApi
      .list({ isActive: true, pageSize: 500 })
      .then((res) => setMembers(res.items))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  useEffect(() => { fetchData(selectedDate); }, [selectedDate, fetchData]);

  // ── Date handlers ─────────────────────────────────────────────────────────
  function handlePrevDay() { setSelectedDate((d) => offsetDate(d, -1)); }

  function handleNextDay() {
    const next = offsetDate(selectedDate, 1);
    if (next <= todayStr()) setSelectedDate(next);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setSelectedDate(e.target.value);
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleCreate = async (payload: PaymentCreate) => {
    setSaving(true);
    try {
      await paymentsApi.create(payload);
      setActiveModal(null);
      await fetchData(selectedDate);
      const label = payload.transaction_type === "OUTFLOW" ? "Retiro registrado" : "Cobro registrado";
      showToast(label);
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await paymentsApi.remove(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      financeApi.dailySummary(selectedDate).then(setSummary).catch(() => {});
      showToast("Eliminado");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isToday  = selectedDate === todayStr();
  const isFuture = offsetDate(selectedDate, 1) > todayStr();

  const incomeRows  = payments.filter((p) => p.transaction_type !== "OUTFLOW");
  const outflowRows = payments.filter((p) => p.transaction_type === "OUTFLOW");
  const incomeTotal  = incomeRows.reduce((s, p) => s + p.amount, 0);
  const outflowTotal = outflowRows.reduce((s, p) => s + p.amount, 0);

  // ── No club ───────────────────────────────────────────────────────────────
  if (!sessionLoading && !activeClub) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-gray-900">Caja Diaria</h1>
        <p className="mt-8 text-center text-sm text-gray-400">No hay ningún club activo.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Caja Diaria"
        subtitle={<span className="capitalize">{formatDisplayDate(selectedDate)}</span>}
      >
        <div className="flex items-center gap-2">
          {/* Prev day */}
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevDay}
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Date input */}
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={handleDateInput}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400 transition cursor-pointer"
          />

          {/* Next day */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextDay}
            disabled={isToday || isFuture}
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isToday && (
            <Button variant="outline" onClick={() => setSelectedDate(todayStr())}>
              Hoy
            </Button>
          )}

          {/* Retiro / Vale */}
          <ActionButton icon={Minus} variant="destructive" onClick={() => setActiveModal("outflow")}>
            Retiro
          </ActionButton>

          {/* Registrar cobro */}
          <ActionButton icon={Plus} onClick={() => setActiveModal("income")}>
            Registrar cobro
          </ActionButton>
        </div>
      </PageHeader>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Stat cards — 4 columnas ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Ingresos"
          icon={TrendingUp}
          variant="income"
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-emerald-100" />
            : fmtMoney(summary?.total_income ?? 0)}
          sub={`${incomeRows.length} cobro${incomeRows.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Retiros"
          icon={ArrowDownLeft}
          variant={loading ? "default" : (summary?.total_outflow ?? 0) > 0 ? "outflow" : "default"}
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-gray-100" />
            : fmtMoney(summary?.total_outflow ?? 0)}
          sub={`${outflowRows.length} retiro${outflowRows.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Egresos operativos"
          icon={TrendingDown}
          variant="expense"
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-red-100" />
            : fmtMoney(summary?.total_expenses ?? 0)}
          sub="gastos del día"
        />
        <StatCard
          label="Balance neto"
          icon={Scale}
          variant={
            loading
              ? "default"
              : (summary?.net_balance ?? 0) >= 0 ? "balance-pos" : "balance-neg"
          }
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-gray-100" />
            : `${(summary?.net_balance ?? 0) >= 0 ? "+" : ""}${fmtMoney(summary?.net_balance ?? 0)}`}
          sub={(summary?.net_balance ?? 0) >= 0 ? "superávit" : "déficit"}
        />
      </div>

      {/* ── Method breakdown pills ────────────────────────────────────────── */}
      {!loading && summary && Object.keys(summary.income_by_method).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.income_by_method).map(([method, total]) => (
            <span
              key={method}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                METHOD_BADGE[method] ?? "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method}
              <span className="tabular-nums">{fmtMoneyExact(total)}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Payments table ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {[
                { label: "Hora",        cls: "text-left"  },
                { label: "Tipo",        cls: "text-left"  },
                { label: "Descripción", cls: "text-left"  },
                { label: "Método",      cls: "text-left"  },
                { label: "Importe",     cls: "text-right" },
                { label: "Acciones",    cls: "text-right w-[80px]" },
              ].map(({ label, cls }) => (
                <th
                  key={label}
                  className={`px-4 py-3.5 text-xs font-medium uppercase tracking-wide text-gray-400 ${cls}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
              : payments.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-gray-200" />
                      No hay movimientos registrados este día
                    </div>
                  </td>
                </tr>
              )
              : payments.map((payment) => {
                  const isOutflow    = payment.transaction_type === "OUTFLOW";
                  const isConfirming = confirmDelete === payment.id;
                  const isDeleting   = deleting      === payment.id;

                  return (
                    <tr
                      key={payment.id}
                      className={`transition-colors ${
                        isConfirming ? "bg-red-50"
                        : isOutflow  ? "bg-orange-50/40 hover:bg-orange-50"
                        : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Hora */}
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-gray-400">
                        {formatTime(payment.payment_date)}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3.5">
                        {isOutflow ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                            <ArrowDownLeft className="h-3 w-3" />
                            Retiro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <ArrowUpRight className="h-3 w-3" />
                            Cobro
                          </span>
                        )}
                      </td>

                      {/* Descripción */}
                      <td className={`px-4 py-3.5 font-medium max-w-[200px] truncate ${
                        isOutflow ? "text-orange-800" : "text-gray-900"
                      }`}>
                        {payment.description}
                      </td>

                      {/* Método */}
                      <td className="px-4 py-3.5">
                        <MethodBadge method={payment.payment_method} />
                      </td>

                      {/* Importe */}
                      <td className={`px-4 py-3.5 text-right tabular-nums font-semibold ${
                        isOutflow ? "text-red-600" : "text-gray-900"
                      }`}>
                        {isOutflow ? "−" : "+"}{fmtMoneyExact(payment.amount)}
                      </td>

                      {/* Acciones */}
                      <td className="w-[80px] px-4 py-3.5">
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-red-600">¿Eliminar?</span>
                            <button
                              onClick={() => handleDelete(payment.id)}
                              disabled={isDeleting}
                              className="cursor-pointer rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition disabled:opacity-50"
                            >
                              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => setConfirmDelete(payment.id)}
                              title="Eliminar"
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

        {/* Footer */}
        {payments.length > 0 && (
          <div className="border-t border-gray-50 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {payments.length} movimiento{payments.length !== 1 ? "s" : ""}
              {" · "}
              {incomeRows.length} cobro{incomeRows.length !== 1 ? "s" : ""}
              {outflowRows.length > 0 && ` · ${outflowRows.length} retiro${outflowRows.length !== 1 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-400">
                Cobros: <span className="font-semibold tabular-nums text-gray-900">{fmtMoneyExact(incomeTotal)}</span>
              </span>
              {outflowTotal > 0 && (
                <span className="text-gray-400">
                  Retiros: <span className="font-semibold tabular-nums text-red-600">−{fmtMoneyExact(outflowTotal)}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {activeModal && (
        <PaymentFormModal
          target={activeModal}
          onClose={() => { if (!saving) setActiveModal(null); }}
          onSave={handleCreate}
          members={loadingMembers ? [] : members}
          saving={saving}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
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
