"use client";
// apps/web/app/(dashboard)/reservations/components/CreateReservationModal.tsx
// Modal para crear una nueva reserva: selección de socio, duración y notas.

import { Timer, User, FileText, X, XCircle } from "lucide-react";

import { SPORT_LABELS, SPORT_COLORS }                        from "./constants";
import { addMinutes, buildSlotDate }                         from "./helpers";
import { SLOT_DURATION_OPTIONS }                             from "./types";
import type { MemberUser, SelectedSlot, SlotDuration }       from "./types";

// ── Props ───────────────────────────────────────────────────────────────────

interface CreateReservationModalProps {
  selectedSlot:    SelectedSlot;
  selectedDate:    Date;
  slotDuration:    SlotDuration;
  onDurationChange:(d: SlotDuration) => void;
  selectedUserId:  string;
  onUserChange:    (id: string) => void;
  notes:           string;
  onNotesChange:   (n: string) => void;
  memberUsers:     MemberUser[];
  isSaving:        boolean;
  modalError:      string | null;
  onClose:         () => void;
  onConfirm:       () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CreateReservationModal({
  selectedSlot,
  selectedDate,
  slotDuration,
  onDurationChange,
  selectedUserId,
  onUserChange,
  notes,
  onNotesChange,
  memberUsers,
  isSaving,
  modalError,
  onClose,
  onConfirm,
}: CreateReservationModalProps) {
  const slotEndTime = addMinutes(
    buildSlotDate(selectedDate, selectedSlot.slot),
    slotDuration,
  ).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const totalPrice = parseFloat(
    (selectedSlot.hourlyRate * slotDuration / 60).toFixed(2),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 flex-shrink-0">
              <Timer className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Nueva reserva</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedSlot.courtName} ·{" "}
                {selectedDate.toLocaleDateString("es-AR", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer disabled:opacity-40 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Info del slot ──────────────────────────────────────────────── */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Horario seleccionado
              </p>
              <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                {selectedSlot.slot}
                <span className="text-gray-300 font-light mx-2">→</span>
                {slotEndTime}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  SPORT_COLORS[selectedSlot.courtSport] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {SPORT_LABELS[selectedSlot.courtSport] ?? selectedSlot.courtSport}
              </span>
              {totalPrice > 0 && (
                <p className="text-lg font-bold text-gray-900 mt-1.5 tabular-nums">
                  ${totalPrice.toLocaleString("es-AR")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Duración ───────────────────────────────────────────────────── */}
        <div className="px-6 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Duración
          </p>
          <div className="flex gap-2">
            {SLOT_DURATION_OPTIONS.map((d) => {
              const price  = parseFloat((selectedSlot.hourlyRate * d / 60).toFixed(2));
              const active = slotDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => onDurationChange(d)}
                  disabled={isSaving}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-center transition cursor-pointer disabled:opacity-40 ${
                    active
                      ? "text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  style={
                    active
                      ? { backgroundColor: "var(--color-brand)", borderColor: "var(--color-brand)" }
                      : {}
                  }
                >
                  <div className="text-sm font-bold">{d} min</div>
                  {price > 0 && (
                    <div
                      className={`text-xs mt-0.5 ${
                        active ? "text-white/60" : "text-gray-400"
                      }`}
                    >
                      ${price.toLocaleString("es-AR")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Formulario ─────────────────────────────────────────────────── */}
        <div className="space-y-4 px-6 pt-4 pb-2">

          {/* Socio */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <User className="h-3 w-3" />
              Socio
            </label>
            {memberUsers.length > 0 ? (
              <select
                value={selectedUserId}
                onChange={(e) => onUserChange(e.target.value)}
                disabled={isSaving}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60 cursor-pointer"
              >
                <option value="" disabled>Seleccioná un socio…</option>
                {memberUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                    {u.member_number ? ` · N° ${u.member_number}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-gray-400 italic">
                No se pudieron cargar los socios. Recargá la página.
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <FileText className="h-3 w-3" />
              Notas
              <span className="font-normal normal-case text-gray-300">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              disabled={isSaving}
              placeholder="Ej: clase con profe, turno fijo…"
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60"
            />
          </div>

          {/* Error */}
          {modalError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{modalError}</p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving || !selectedUserId}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {isSaving ? "Reservando…" : "Confirmar turno"}
          </button>
        </div>
      </div>
    </div>
  );
}
