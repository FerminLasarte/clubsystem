"use client";
// apps/web/app/(dashboard)/reservations/components/ReservationGrid.tsx
// Grilla horaria de canchas × slots de 30 min.

import { Plus } from "lucide-react";

import { SPORT_LABELS, SPORT_COLORS, STATUS_CONFIG } from "./constants";
import { getReservationForSlot, toLocalTime }                    from "./helpers";
import type { Court, Reservation }                               from "./types";

// ── Skeleton ────────────────────────────────────────────────────────────────

function GridSkeleton({ cols, rowCount }: { cols: number; rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3 border-r border-gray-50">
            <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
          </td>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-2 border-l border-gray-50">
              <div className="h-14 animate-pulse rounded-lg bg-gray-50" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ReservationGridProps {
  courts:       Court[];
  reservations: Reservation[];
  loading:      boolean;
  /** Slots generados desde open_time/close_time del club ("HH:MM"). */
  timeSlots:    readonly string[];
  onSlotClick:  (court: Court, slot: string) => void;
  onCellClick:  (res: Reservation) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ReservationGrid({
  courts, reservations, loading, timeSlots, onSlotClick, onCellClick,
}: ReservationGridProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">

          {/* ── Cabecera: canchas ─────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-400 w-20">
                Horario
              </th>

              {loading
                ? [1, 2, 3].map((i) => (
                    <th key={i} className="px-4 py-4 border-l border-gray-50">
                      <div className="h-3 w-24 animate-pulse rounded bg-gray-100 mx-auto" />
                    </th>
                  ))
                : courts.map((court) => (
                    <th
                      key={court.id}
                      className="px-4 py-4 text-center border-l border-gray-50 min-w-[160px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          {court.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              SPORT_COLORS[court.sport] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {SPORT_LABELS[court.sport] ?? court.sport}
                          </span>
                          {court.surface && (
                            <span className="text-[10px] text-gray-400">
                              {court.surface === "clay"
                                ? "Polvo"
                                : court.surface === "hard"
                                ? "Cemento"
                                : court.surface === "synthetic"
                                ? "Sintético"
                                : court.surface === "grass"
                                ? "Césped"
                                : court.surface}
                              {court.is_indoor ? " · Cubierta" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
            </tr>
          </thead>

          {/* ── Filas: slots de tiempo ────────────────────────────────── */}
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <GridSkeleton cols={3} rowCount={timeSlots.length || 28} />
            ) : courts.length === 0 ? (
              <tr>
                <td
                  colSpan={99}
                  className="px-6 py-16 text-center text-sm text-gray-400"
                >
                  No hay canchas para el filtro seleccionado
                </td>
              </tr>
            ) : (
              timeSlots.map((slot) => (
                <tr key={slot} className="group">
                  {/* Etiqueta de hora */}
                  <td className="px-4 py-2 border-r border-gray-50 tabular-nums text-xs font-medium text-gray-400 w-20">
                    {slot}
                  </td>

                  {/* Celda por cancha */}
                  {courts.map((court) => {
                    const res = getReservationForSlot(reservations, court.id, slot);
                    const cfg = res ? STATUS_CONFIG[res.status] : null;

                    return (
                      <td
                        key={`${court.id}-${slot}`}
                        className="p-2 border-l border-gray-50"
                      >
                        {res && cfg ? (
                          /* Celda ocupada */
                          <button
                            onClick={() => onCellClick(res)}
                            className={`w-full rounded-lg border px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer transition hover:brightness-95 text-left ${cfg.bg} ${cfg.border}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}
                              />
                              <span
                                className={`text-xs font-semibold truncate ${cfg.text}`}
                              >
                                {res.user_name}
                              </span>
                            </div>
                            {res.notes && (
                              <span className="text-[10px] text-gray-400 truncate pl-3">
                                {res.notes}
                              </span>
                            )}
                            <span
                              className={`text-[10px] pl-3 ${cfg.text} opacity-70`}
                            >
                              {toLocalTime(res.starts_at)} – {toLocalTime(res.ends_at)}
                            </span>
                          </button>
                        ) : (
                          /* Celda libre */
                          <button
                            onClick={() => onSlotClick(court, slot)}
                            className="w-full min-h-[48px] rounded-lg border-2 border-dashed border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center group/cell cursor-pointer"
                            title={`Reservar ${court.name} · ${slot}`}
                          >
                            <Plus className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer con métricas */}
      {!loading && courts.length > 0 && (
        <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {courts.length} cancha{courts.length !== 1 ? "s" : ""} ·{" "}
            {timeSlots.length} franjas horarias
          </p>
          <p className="text-xs text-gray-400">
            {reservations.length} ocupado{reservations.length !== 1 ? "s" : ""} ·{" "}
            {courts.length * timeSlots.length - reservations.length} disponibles
          </p>
        </div>
      )}
    </div>
  );
}
