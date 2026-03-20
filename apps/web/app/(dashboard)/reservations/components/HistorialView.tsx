"use client";
// apps/web/app/(dashboard)/reservations/components/HistorialView.tsx
// Vista de historial: tabla de turnos completados con paginación en memoria.

import { History } from "lucide-react";

import { initials, toLocalDate, toLocalTime, durationMinutes } from "./helpers";
import type { Reservation }                                     from "./types";

// ── Props ───────────────────────────────────────────────────────────────────

interface HistorialViewProps {
  data:       Reservation[];
  loading:    boolean;
  error:      string | null;
  onRowClick: (res: Reservation) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function HistorialView({
  data, loading, error, onRowClick,
}: HistorialViewProps) {
  const totalRecaudado = data.reduce((sum, r) => sum + Number(r.total_price), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">

      {/* Loading */}
      {loading && (
        <div className="px-6 py-16 text-center text-sm text-gray-400">
          Cargando historial…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="px-6 py-8 text-center text-sm text-red-500">{error}</div>
      )}

      {/* Empty */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16">
          <History className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay turnos completados todavía.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && data.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                Fecha
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                Cancha
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                Socio
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                Horario
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wide text-gray-400">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick(r)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {toLocalDate(r.starts_at)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-gray-900">{r.court_name}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                      <span className="text-[9px] font-bold text-gray-500">
                        {initials(r.user_name)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">{r.user_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm tabular-nums text-gray-700">
                    {toLocalTime(r.starts_at)} – {toLocalTime(r.ends_at)}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {durationMinutes(r)} min
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                    ${Number(r.total_price).toLocaleString("es-AR")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer */}
      {!loading && data.length > 0 && (
        <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {data.length} turno{data.length !== 1 ? "s" : ""} completado
            {data.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-gray-400 tabular-nums">
            Total recaudado: ${totalRecaudado.toLocaleString("es-AR")}
          </p>
        </div>
      )}
    </div>
  );
}
