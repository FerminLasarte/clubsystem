"use client";
// apps/web/app/(dashboard)/billing/page.tsx
//
// Módulo de Cuotas Societarias y Cobranzas.
//
// Datos:    feesApi (list, generate, pay, cancel, plans)
// Sesión:   useClubSession()
// Tipos:    FeeOut, GenerateFeesPayload (de lib/api.ts)
//
// Flujos:
//  · Filtrar por mes/año → refetch lista de cuotas
//  · Cobrar → POST /fees/{id}/pay → actualiza fila en tabla + recalcula KPIs
//  · Cancelar → POST /fees/{id}/cancel → actualiza fila
//  · Generar cuotas → modal con plan → monto → POST /fees/generate → refetch

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Package,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { ActionButton } from "@/components/ui/action-button";
import { PageHeader }   from "@/components/ui/page-header";
import { useClubSession }                                      from "@/contexts/ClubSessionContext";
import { feesApi, type FeeOut, type GenerateFeesPayload }     from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return "$\u00A0" + Math.round(n).toLocaleString("es-AR");
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; ok: boolean }

let _toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, ok = true) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return { toasts, push };
}

// ── CARD_STYLES ───────────────────────────────────────────────────────────────

type CardVariant = "default" | "income" | "pending" | "expected";

const CARD_STYLES: Record<CardVariant, {
  wrap: string; label: string; icon: string; iconWrap: string; value: string; sub: string;
}> = {
  default:  { wrap: "border-gray-100 bg-white", label: "text-gray-400", icon: "text-gray-400",    iconWrap: "bg-gray-50",    value: "text-gray-900",    sub: "text-gray-400"    },
  expected: { wrap: "border-gray-100 bg-white", label: "text-gray-400", icon: "text-blue-500",    iconWrap: "bg-blue-50",    value: "text-gray-900",    sub: "text-gray-400"    },
  income:   { wrap: "border-emerald-100 bg-white", label: "text-gray-400", icon: "text-emerald-500", iconWrap: "bg-emerald-50", value: "text-emerald-700", sub: "text-emerald-500" },
  pending:  { wrap: "border-red-100 bg-white",    label: "text-gray-400", icon: "text-red-500",    iconWrap: "bg-red-50",    value: "text-red-700",    sub: "text-red-400"    },
};

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

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeeOut["status"] }) {
  const cfg: Record<FeeOut["status"], { label: string; cls: string }> = {
    PENDING:   { label: "Pendiente", cls: "border-amber-200 bg-amber-50 text-amber-700"       },
    PAID:      { label: "Cobrado",   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    CANCELLED: { label: "Cancelado", cls: "border-border bg-muted text-muted-foreground"      },
  };
  const { label, cls } = cfg[status] ?? cfg.PENDING;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── GenerateFeesModal ─────────────────────────────────────────────────────────

interface GenerateModalProps {
  month:    number;
  year:     number;
  onClose:  () => void;
  onSuccess: (msg: string) => void;
}

function GenerateFeesModal({ month, year, onClose, onSuccess }: GenerateModalProps) {
  const [plans,      setPlans]      = useState<string[]>([]);
  const [amounts,    setAmounts]    = useState<Record<string, string>>({});
  const [dueDay,     setDueDay]     = useState("10");
  const [overwrite,  setOverwrite]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Cargar planes existentes
  useEffect(() => {
    feesApi.plans()
      .then((p) => {
        setPlans(p);
        setAmounts(Object.fromEntries(p.map((name) => [name, ""])));
      })
      .catch(() => setError("No se pudieron cargar los planes."))
      .finally(() => setFetching(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const plan_amounts: Record<string, number> = {};
    for (const [plan, raw] of Object.entries(amounts)) {
      const n = parseFloat(raw);
      if (!raw || isNaN(n) || n <= 0) {
        setError(`Ingresá un monto válido para el plan "${plan}".`);
        return;
      }
      plan_amounts[plan] = n;
    }

    if (Object.keys(plan_amounts).length === 0) {
      setError("No hay planes configurados. Asegurate de que los socios tengan un plan asignado.");
      return;
    }

    const payload: GenerateFeesPayload = {
      month,
      year,
      plan_amounts,
      due_day:   parseInt(dueDay, 10) || 10,
      overwrite,
    };

    setLoading(true);
    try {
      const result = await feesApi.generate(payload);
      onSuccess(result.message);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al generar las cuotas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative my-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Generar Cuotas del Mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {fetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No se encontraron planes en los socios activos. Asignales un plan en el módulo de Socios.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Monto por plan ($ ARS)</p>
                {plans.map((plan) => (
                  <div key={plan} className="flex items-center gap-3">
                    <label className="w-40 truncate text-sm text-foreground">{plan}</label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="0"
                        value={amounts[plan] ?? ""}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [plan]: e.target.value }))}
                        className="w-full rounded-lg border border-border py-2 pl-6 pr-3 text-sm focus:border-foreground/30 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Día de vencimiento</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">Sobreescribir existentes</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {!fetching && plans.length > 0 && (
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {loading ? "Generando..." : "Generar cuotas"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { activeClub } = useClubSession();
  const { toasts, push } = useToast();

  // Mes/año por defecto = hoy
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [fees,         setFees]         = useState<FeeOut[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionId,     setActionId]     = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchFees = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    try {
      const data = await feesApi.list({ month, year });
      setFees(data);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Error al cargar las cuotas.", false);
    } finally {
      setLoading(false);
    }
  }, [activeClub?.clubId, month, year]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  // ── Navegar mes ────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // ── Cobrar cuota ───────────────────────────────────────────────────────────
  async function handlePay(feeId: string) {
    setActionId(feeId);
    try {
      const updated = await feesApi.pay(feeId);
      setFees((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      push("Cuota cobrada correctamente.");
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Error al cobrar la cuota.", false);
    } finally {
      setActionId(null);
    }
  }

  // ── Cancelar cuota ─────────────────────────────────────────────────────────
  async function handleCancel(feeId: string) {
    setConfirmCancel(null);
    setActionId(feeId);
    try {
      await feesApi.cancel(feeId);
      setFees((prev) =>
        prev.map((f) => (f.id === feeId ? { ...f, status: "CANCELLED" as const } : f))
      );
      push("Cuota cancelada.");
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Error al cancelar la cuota.", false);
    } finally {
      setActionId(null);
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const activeFees    = fees.filter((f) => f.status !== "CANCELLED");
  const paidFees      = fees.filter((f) => f.status === "PAID");
  const pendingFees   = fees.filter((f) => f.status === "PENDING");

  const totalExpected = activeFees.reduce((s, f) => s + f.amount, 0);
  const totalPaid     = paidFees.reduce((s, f) => s + f.amount, 0);
  const totalPending  = pendingFees.reduce((s, f) => s + f.amount, 0);

  const collectionPct = totalExpected > 0
    ? Math.round((totalPaid / totalExpected) * 100)
    : 0;

  // ── Sin club ───────────────────────────────────────────────────────────────
  if (!activeClub) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Estado de Cuotas</h1>
        <div className="rounded-xl border border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          No hay ningún club activo seleccionado.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Estado de Cuotas"
        subtitle={`${MONTH_NAMES[month - 1]} ${year} · ${activeFees.length} cuota${activeFees.length !== 1 ? "s" : ""}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegación mes */}
          <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
            <button
              onClick={prevMonth}
              className="px-3 py-2 text-muted-foreground hover:bg-muted transition cursor-pointer"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] px-2 py-2 text-center text-sm font-medium text-foreground select-none">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="px-3 py-2 text-muted-foreground hover:bg-muted transition cursor-pointer"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Selector año directo */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none hover:bg-muted transition cursor-pointer"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Generar cuotas */}
          <ActionButton icon={Plus} onClick={() => setShowGenerate(true)}>
            Generar cuotas
          </ActionButton>
        </div>
      </PageHeader>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Recaudación esperada"
          icon={CircleDollarSign}
          variant="expected"
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-muted" />
            : fmtMoney(totalExpected)}
          sub={`${activeFees.length} cuota${activeFees.length !== 1 ? "s" : ""} activas`}
        />
        <StatCard
          label="Cobrado"
          icon={TrendingUp}
          variant="income"
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-emerald-100" />
            : fmtMoney(totalPaid)}
          sub={`${collectionPct}% cobrado · ${paidFees.length} cuota${paidFees.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Pendiente / Deuda"
          icon={TrendingDown}
          variant={pendingFees.length > 0 ? "pending" : "default"}
          value={loading
            ? <div className="h-8 w-28 animate-pulse rounded bg-red-100" />
            : fmtMoney(totalPending)}
          sub={`${pendingFees.length} moroso${pendingFees.length !== 1 ? "s" : ""}`}
        />
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Detalle de cuotas
          </h2>
          {!loading && pendingFees.length > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {pendingFees.length} pendiente{pendingFees.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Socio</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Concepto</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Vencimiento</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
              <th className="w-[140px] px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : fees.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm text-muted-foreground">
                      <Package className="mx-auto mb-2 h-8 w-8 text-border" />
                      No hay cuotas para {MONTH_NAMES[month - 1]} {year}.
                      <br />
                      <button
                        onClick={() => setShowGenerate(true)}
                        className="mt-3 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
                      >
                        Generar cuotas del mes →
                      </button>
                    </td>
                  </tr>
                )
                : fees.map((fee) => {
                    const isPending   = fee.status === "PENDING";
                    const isBusy      = actionId === fee.id;
                    const isConfirming = confirmCancel === fee.id;

                    return (
                      <tr
                        key={fee.id}
                        className={
                          isPending
                            ? "hover:bg-amber-50/40 bg-amber-50/20"
                            : fee.status === "CANCELLED"
                              ? "opacity-50"
                              : "hover:bg-muted/50"
                        }
                      >
                        {/* Socio */}
                        <td className="px-6 py-3.5">
                          {fee.member ? (
                            <>
                              <p className="font-medium text-foreground">
                                {fee.member.first_name} {fee.member.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fee.member.member_number
                                  ? `#${fee.member.member_number}`
                                  : fee.member.email}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Concepto */}
                        <td className="px-6 py-3.5">
                          <p className="text-foreground">{fee.fee_name}</p>
                          {fee.member?.membership_plan && (
                            <p className="text-xs text-muted-foreground">{fee.member.membership_plan}</p>
                          )}
                        </td>

                        {/* Monto */}
                        <td className="px-6 py-3.5 text-right font-medium tabular-nums text-foreground">
                          {fmtMoney(fee.amount)}
                        </td>

                        {/* Vencimiento */}
                        <td className="px-6 py-3.5 tabular-nums text-muted-foreground">
                          {fmtDate(fee.due_date)}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-3.5">
                          <StatusBadge status={fee.status} />
                        </td>

                        {/* Acciones */}
                        <td className="w-[140px] px-6 py-3.5 text-right">
                          {isPending && !isConfirming && (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Cobrar */}
                              <button
                                onClick={() => handlePay(fee.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition cursor-pointer"
                              >
                                {isBusy
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <CheckCircle className="h-3 w-3" />}
                                Cobrar
                              </button>
                              {/* Cancelar (confirmación inline) */}
                              <button
                                onClick={() => setConfirmCancel(fee.id)}
                                disabled={isBusy}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50 transition cursor-pointer"
                                title="Cancelar cuota"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {/* Confirmación de cancelación inline */}
                          {isConfirming && (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-xs text-muted-foreground">¿Cancelar?</span>
                              <button
                                onClick={() => handleCancel(fee.id)}
                                className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition cursor-pointer"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmCancel(null)}
                                className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          )}

                          {fee.status === "PAID" && (
                            <span className="text-xs text-emerald-500">✓ Cobrado</span>
                          )}
                          {fee.status === "CANCELLED" && (
                            <span className="text-xs text-muted-foreground">Cancelado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
          </tbody>

          {/* Footer con totales */}
          {!loading && fees.length > 0 && (
            <tfoot className="border-t border-border bg-muted/40">
              <tr>
                <td colSpan={2} className="px-6 py-3 text-xs font-medium text-muted-foreground">
                  {paidFees.length} cobrado{paidFees.length !== 1 ? "s" : ""} ·{" "}
                  {pendingFees.length} pendiente{pendingFees.length !== 1 ? "s" : ""}
                </td>
                <td className="px-6 py-3 text-right text-xs font-semibold tabular-nums">
                  <span className="text-emerald-700">{fmtMoney(totalPaid)}</span>
                  {totalPending > 0 && (
                    <> · <span className="text-red-600">{fmtMoney(totalPending)}</span></>
                  )}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Modal Generar Cuotas ────────────────────────────────────────────── */}
      {showGenerate && (
        <GenerateFeesModal
          month={month}
          year={year}
          onClose={() => setShowGenerate(false)}
          onSuccess={(msg) => {
            push(msg);
            fetchFees();
          }}
        />
      )}

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto ${
              t.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}
          >
            {t.ok
              ? <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              : <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0"  />}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
