"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, Clock, XCircle, LayoutGrid,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────

interface Court {
  id: string;
  name: string;
  sport: string;
  surface: string | null;
  is_indoor: boolean;
  hourly_rate: number;
}

interface Reservation {
  id: string;
  court_id: string;
  court_name: string;
  user_id: string;
  user_name: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string;
  total_price: number;
  paid_amount: number;
  notes: string | null;
}

// ── Constants ─────────────────────────────────────────────────

const TIME_SLOTS = [
  "08:00", "09:30", "11:00", "12:30",
  "14:00", "15:30", "17:00", "18:30",
  "20:00", "21:30",
];

const SLOT_DURATION_MIN = 90;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenis",
  padel: "Pádel",
  rugby: "Rugby",
  football: "Fútbol",
  basketball: "Básquet",
  hockey: "Hockey",
  other: "Otro",
};

const STATUS_CONFIG = {
  confirmed: { label: "Confirmada",  bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  pending:   { label: "Pendiente",   bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400"  },
  cancelled: { label: "Cancelada",   bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-400",    dot: "bg-gray-300"   },
  completed: { label: "Completada",  bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-600",    dot: "bg-blue-400"   },
};

// ── Helpers ───────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function isToday(d: Date): boolean {
  return toDateString(d) === toDateString(new Date());
}

// Una reserva "pertenece" a un slot si su hora de inicio cae dentro
// del rango [slot, slot + 90min). Esto resuelve el problema de horas
// que no coinciden exactamente con los slots predefinidos.
function getReservationForSlot(
  reservations: Reservation[],
  courtId: string,
  slot: string,
): Reservation | undefined {
  const slotStart = timeToMinutes(slot);
  const slotEnd = slotStart + SLOT_DURATION_MIN;
  return reservations.find((r) => {
    if (r.court_id !== courtId) return false;
    const resMin = timeToMinutes(toLocalTime(r.starts_at));
    return resMin >= slotStart && resMin < slotEnd;
  });
}

// ── Skeleton ──────────────────────────────────────────────────

function GridSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {TIME_SLOTS.map((slot) => (
        <tr key={slot}>
          <td className="px-4 py-3 border-r border-gray-50">
            <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
          </td>
          {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="p-2 border-l border-gray-50">
              <div className="h-14 animate-pulse rounded-lg bg-gray-50" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function ReservationsPage() {
  const router = useRouter();
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSport, setFilterSport] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    setError(null);
    try {
      const [courtsRes, reservationsRes] = await Promise.all([
        fetch(`${API}/api/v1/courts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/reservations?target_date=${toDateString(selectedDate)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!courtsRes.ok) throw new Error("Error al cargar las canchas");
      if (!reservationsRes.ok) throw new Error("Error al cargar las reservas");
      setCourts(await courtsRes.json());
      setReservations(await reservationsRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sports disponibles según las canchas cargadas
  const availableSports = Array.from(new Set(courts.map((c) => c.sport))).sort();

  // Canchas filtradas por deporte
  const visibleCourts = filterSport ? courts.filter((c) => c.sport === filterSport) : courts;

  // Reservas filtradas por estado, sobre las canchas visibles
  const visibleReservations = reservations.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSport && !visibleCourts.find((c) => c.id === r.court_id)) return false;
    return true;
  });

  const stats = {
    total: reservations.length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    pending:   reservations.filter((r) => r.status === "pending").length,
    cancelled: reservations.filter((r) => r.status === "cancelled" || r.status === "completed").length,
  };

  function prevDay() { setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function nextDay() { setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToday() { setSelectedDate(new Date()); }

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {loading
              ? "Cargando…"
              : `${stats.total} turno${stats.total !== 1 ? "s" : ""} para ${isToday(selectedDate) ? "hoy" : formatDisplayDate(selectedDate)}`}
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva reserva
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Fila 1: navegación de fecha + filtros de estado */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Navegador de fecha */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
            <button onClick={prevDay} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition cursor-pointer ${isToday(selectedDate) ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
              style={isToday(selectedDate) ? { backgroundColor: "var(--color-brand)" } : {}}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {isToday(selectedDate) ? "Hoy" : selectedDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            </button>
            <button onClick={nextDay} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 cursor-pointer">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Filtros de estado */}
          {[
            { key: null,        icon: <LayoutGrid className="h-3.5 w-3.5" />, label: "Todos",       count: stats.total,     countCls: "bg-gray-100 text-gray-500"    },
            { key: "confirmed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Confirmadas", count: stats.confirmed, countCls: "bg-emerald-50 text-emerald-600" },
            { key: "pending",   icon: <Clock className="h-3.5 w-3.5" />,      label: "Pendientes",  count: stats.pending,   countCls: "bg-amber-50 text-amber-600"    },
            { key: "cancelled", icon: <XCircle className="h-3.5 w-3.5" />,    label: "Canceladas",  count: stats.cancelled, countCls: "bg-gray-100 text-gray-500"    },
          ].map(({ key, icon, label, count, countCls }) => {
            const active = filterStatus === key;
            return (
              <button
                key={String(key)}
                onClick={() => setFilterStatus(active && key !== null ? null : key)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                style={active ? { backgroundColor: "var(--color-brand)" } : {}}
              >
                {icon}
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/20 text-white" : countCls}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fila 2: filtros por deporte (solo si hay más de un deporte) */}
        {!loading && availableSports.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Deporte:</span>
            <button
              onClick={() => setFilterSport(null)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${filterSport === null ? "text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              style={filterSport === null ? { backgroundColor: "var(--color-brand)" } : {}}
            >
              Todos
            </button>
            {availableSports.map((sport) => {
              const active = filterSport === sport;
              const courtCount = courts.filter((c) => c.sport === sport).length;
              return (
                <button
                  key={sport}
                  onClick={() => setFilterSport(active ? null : sport)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${active ? "text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  style={active ? { backgroundColor: "var(--color-brand)" } : {}}
                >
                  {SPORT_LABELS[sport] ?? sport}
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {courtCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Grilla ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                  : visibleCourts.map((court) => (
                      <th key={court.id} className="px-4 py-4 text-center border-l border-gray-50 min-w-[160px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            {court.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              {SPORT_LABELS[court.sport] ?? court.sport}
                            </span>
                            {court.surface && (
                              <span className="text-[10px] text-gray-400">
                                {court.surface === "clay" ? "Polvo" : court.surface === "hard" ? "Cemento" : court.surface === "synthetic" ? "Sintético" : court.surface === "grass" ? "Césped" : court.surface}
                                {court.is_indoor ? " · Cubierta" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <GridSkeleton cols={3} />
              ) : visibleCourts.length === 0 ? (
                <tr>
                  <td colSpan={99} className="px-6 py-16 text-center text-sm text-gray-400">
                    No hay canchas para el filtro seleccionado
                  </td>
                </tr>
              ) : (
                TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="group">
                    <td className="px-4 py-2 border-r border-gray-50 tabular-nums text-xs font-medium text-gray-400 w-20">
                      {slot}
                    </td>
                    {visibleCourts.map((court) => {
                      const res = getReservationForSlot(visibleReservations, court.id, slot);
                      const cfg = res ? STATUS_CONFIG[res.status] : null;
                      return (
                        <td key={`${court.id}-${slot}`} className="p-2 border-l border-gray-50">
                          {res && cfg ? (
                            <div className={`w-full rounded-lg border px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer transition hover:brightness-95 ${cfg.bg} ${cfg.border}`}>
                              <div className="flex items-center gap-1.5">
                                <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <span className={`text-xs font-semibold truncate ${cfg.text}`}>
                                  {res.user_name}
                                </span>
                              </div>
                              {res.notes && (
                                <span className="text-[10px] text-gray-400 truncate pl-3">{res.notes}</span>
                              )}
                              <span className={`text-[10px] pl-3 ${cfg.text} opacity-70`}>
                                {toLocalTime(res.starts_at)} – {toLocalTime(res.ends_at)}
                              </span>
                            </div>
                          ) : (
                            <button className="w-full min-h-[64px] rounded-lg border-2 border-dashed border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center group/cell cursor-pointer">
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

        {!loading && visibleCourts.length > 0 && (
          <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {visibleCourts.length} cancha{visibleCourts.length !== 1 ? "s" : ""} · {TIME_SLOTS.length} franjas horarias
            </p>
            <p className="text-xs text-gray-400">
              {visibleReservations.length} ocupado{visibleReservations.length !== 1 ? "s" : ""} · {visibleCourts.length * TIME_SLOTS.length - visibleReservations.length} disponibles
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
