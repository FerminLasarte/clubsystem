"use client";
// apps/web/app/(dashboard)/cash/page.tsx
// Módulo de Cobros y Caja Diaria — orquestador principal.

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import {
  financeApi,
  paymentsApi,
  membersApi,
  type DailySummary,
  type PaymentOut,
  type PaymentCreate,
  type MemberOut,
} from "@/lib/api";

import { SummaryCards }     from "./components/SummaryCards";
import { PaymentsTable }    from "./components/PaymentsTable";
import { PaymentFormModal } from "./components/PaymentFormModal";

// ── Date helpers (sin timezone flip) ─────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(dateStr: string, days: number): string {
  // Usar T12:00:00 para evitar problemas de UTC off-by-one
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  const [summary,  setSummary]  = useState<DailySummary | null>(null);
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [members,  setMembers]  = useState<MemberOut[]>([]);

  const [loadingData,    setLoadingData]    = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ── Fetch summary + payments ──────────────────────────────────────────────
  const fetchData = useCallback(async (date: string) => {
    setLoadingData(true);
    setError(null);
    try {
      const [sum, pmts] = await Promise.all([
        financeApi.dailySummary(date),
        paymentsApi.list(date),
      ]);
      setSummary(sum);
      setPayments(pmts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar los datos";
      setError(msg);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // ── Fetch members once ────────────────────────────────────────────────────
  useEffect(() => {
    membersApi
      .list({ isActive: true, pageSize: 500 })
      .then((res) => setMembers(res.items))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  // ── Refetch when date changes ─────────────────────────────────────────────
  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handlePrevDay() {
    setSelectedDate((d) => offsetDate(d, -1));
  }

  function handleNextDay() {
    const next = offsetDate(selectedDate, 1);
    if (next <= todayStr()) setSelectedDate(next);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setSelectedDate(e.target.value);
  }

  async function handleCreate(payload: PaymentCreate) {
    setSaving(true);
    try {
      await paymentsApi.create(payload);
      setShowModal(false);
      await fetchData(selectedDate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar el cobro";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    setDeleting(id);
    try {
      await paymentsApi.remove(id);
      await fetchData(selectedDate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar el cobro";
      alert(msg);
    } finally {
      setDeleting(null);
    }
  }

  const isToday = selectedDate === todayStr();
  const isFuture = offsetDate(selectedDate, 1) > todayStr();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5">
            <Wallet className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caja Diaria</h1>
            <p className="text-sm text-gray-400 capitalize">
              {formatDisplayDate(selectedDate)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Registrar cobro
        </button>
      </div>

      {/* ── Date navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevDay}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
          aria-label="Día anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <input
          type="date"
          value={selectedDate}
          max={todayStr()}
          onChange={handleDateInput}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />

        <button
          onClick={handleNextDay}
          disabled={isToday || isFuture}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Día siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Hoy
          </button>
        )}
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <SummaryCards summary={summary} loading={loadingData} />

      {/* ── Payments table ──────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Cobros registrados
        </h2>
        <PaymentsTable
          payments={payments}
          loading={loadingData}
          onDelete={handleDelete}
          deleting={deleting}
        />
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <PaymentFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
        members={loadingMembers ? [] : members}
        saving={saving}
      />
    </div>
  );
}
