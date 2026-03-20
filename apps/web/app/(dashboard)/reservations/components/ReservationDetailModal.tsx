"use client";
// apps/web/app/(dashboard)/reservations/components/ReservationDetailModal.tsx
// Modal de detalle de una reserva existente: info, notas y cancelación.

import { X, DollarSign, FileText, XCircle, AlertTriangle } from "lucide-react";

import { STATUS_CONFIG }                             from "./constants";
import { initials, toLocalDate, toLocalTime, durationMinutes } from "./helpers";
import type { Reservation }                          from "./types";

// ── Props ───────────────────────────────────────────────────────────────────

interface ReservationDetailModalProps {
  reservation:     Reservation;
  cancelConfirm:   boolean;
  isCancelling:    boolean;
  cancelError:     string | null;
  onClose:         () => void;
  onCancelRequest: () => void;
  onCancelConfirm: () => void;
  onCancelAbort:   () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ReservationDetailModal({
  reservation,
  cancelConfirm,
  isCancelling,
  cancelError,
  onClose,
  onCancelRequest,
  onCancelConfirm,
  onCancelAbort,
}: ReservationDetailModalProps) {
  const cfg       = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.confirmed;
  const ini       = initials(reservation.user_name);
  const canCancel =
    reservation.status !== "cancelled" && reservation.status !== "completed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-gray-900">
                {reservation.court_name}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}
              >
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {toLocalDate(reservation.starts_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer mt-0.5 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Horario prominente ─────────────────────────────────────────── */}
        <div className="px-6 pt-4">
          <div className={`rounded-xl border px-4 py-3.5 ${cfg.bg} ${cfg.border}`}>
            <p
              className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${cfg.text} opacity-70`}
            >
              Horario
            </p>
            <p className={`text-2xl font-black tabular-nums leading-none ${cfg.text}`}>
              {toLocalTime(reservation.starts_at)}
              <span className="font-light opacity-40 mx-2">→</span>
              {toLocalTime(reservation.ends_at)}
            </p>
            <p className={`text-xs mt-1 ${cfg.text} opacity-60`}>
              {durationMinutes(reservation)} minutos
            </p>
          </div>
        </div>

        {/* ── Cuerpo ─────────────────────────────────────────────────────── */}
        <div className="px-6 pt-4 pb-2 space-y-3">

          {/* Socio + importe */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
              <span className="text-xs font-bold text-gray-600">{ini}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {reservation.user_name}
              </p>
              <p className="text-xs text-gray-400">Socio</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <p className="text-sm font-bold text-gray-900 tabular-nums">
                  {Number(reservation.total_price).toLocaleString("es-AR")}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                pagado ${Number(reservation.paid_amount).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          {/* Notas */}
          {reservation.notes && (
            <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">{reservation.notes}</p>
            </div>
          )}

          {/* Error de cancelación */}
          {cancelError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{cancelError}</p>
            </div>
          )}

          {/* Confirmación inline de cancelación */}
          {cancelConfirm && canCancel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  ¿Cancelar este turno?
                </p>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                El horario queda disponible. No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onCancelAbort}
                  disabled={isCancelling}
                  className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition cursor-pointer disabled:opacity-50"
                >
                  No, mantener
                </button>
                <button
                  onClick={onCancelConfirm}
                  disabled={isCancelling}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? "Cancelando…" : "Sí, cancelar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {!cancelConfirm && (
          <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isCancelling}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-40"
            >
              Cerrar
            </button>
            {canCancel && (
              <button
                onClick={onCancelRequest}
                disabled={isCancelling}
                className="flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 cursor-pointer disabled:opacity-50"
              >
                Cancelar turno
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
