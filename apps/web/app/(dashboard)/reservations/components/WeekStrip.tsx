"use client";
// apps/web/app/(dashboard)/reservations/components/WeekStrip.tsx
// Selector de fecha semanal: muestra los 7 días de la semana activa
// con navegación prev/next y resaltado del día seleccionado.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { isToday, toDateString }     from "./helpers";

// ── Helpers de semana ───────────────────────────────────────────────────────

/** Lunes de la semana que contiene a `d`. */
export function getWeekStart(d: Date): Date {
  const day  = d.getDay();              // 0=Dom … 6=Sáb
  const diff = day === 0 ? -6 : 1 - day; // desplazamiento al lunes
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/** Los 7 días (Lun–Dom) de la semana que contiene a `d`. */
export function getWeekDays(d: Date): Date[] {
  const mon = getWeekStart(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return day;
  });
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

// ── Props ───────────────────────────────────────────────────────────────────

interface WeekStripProps {
  selectedDate: Date;
  onSelect:     (d: Date) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function WeekStrip({ selectedDate, onSelect }: WeekStripProps) {
  const days = getWeekDays(selectedDate);

  /** Lunes de la semana anterior / siguiente. */
  function shiftWeek(delta: -1 | 1) {
    const mon = getWeekStart(selectedDate);
    mon.setDate(mon.getDate() + delta * 7);
    onSelect(mon);
  }

  const monthLabel = days[0].toLocaleDateString("es-AR", {
    month: "long", year: "numeric",
  });

  const selectedStr = toDateString(selectedDate);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Mes + año con flechas */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftWeek(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[120px] text-center text-xs font-semibold capitalize text-gray-600">
          {monthLabel}
        </span>
        <button
          onClick={() => shiftWeek(1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Fila de días */}
      <div className="flex gap-1">
        {days.map((day, i) => {
          const dayStr   = toDateString(day);
          const isActive = dayStr === selectedStr;
          const todayDay = isToday(day);

          return (
            <button
              key={dayStr}
              onClick={() => onSelect(day)}
              className={`relative flex flex-col items-center justify-center rounded-xl px-2.5 py-2 transition cursor-pointer ${
                isActive
                  ? "text-white shadow-sm"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
              style={isActive ? { backgroundColor: "var(--color-brand)" } : {}}
            >
              {/* Letra del día */}
              <span className={`text-[10px] font-semibold uppercase ${isActive ? "text-white/70" : "text-gray-400"}`}>
                {DAY_LABELS[i]}
              </span>
              {/* Número del día */}
              <span className={`text-sm font-bold tabular-nums leading-none mt-0.5 ${isActive ? "text-white" : "text-gray-800"}`}>
                {day.getDate()}
              </span>
              {/* Punto indicador de "hoy" */}
              {todayDay && !isActive && (
                <span
                  className="absolute bottom-1 h-1 w-1 rounded-full"
                  style={{ backgroundColor: "var(--color-brand)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
