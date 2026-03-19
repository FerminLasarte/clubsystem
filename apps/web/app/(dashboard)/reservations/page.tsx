"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, Clock, XCircle, LayoutGrid, X,
  User, FileText, DollarSign, AlertTriangle, Ban,
  Timer, History,
} from "lucide-react";
import { courtsApi, reservationsApi, membersApi } from "@/lib/api";
import { useClubSession } from "@/contexts/ClubSessionContext";

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

interface MemberUser {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string | null;
}

interface SelectedSlot {
  courtId: string;
  courtName: string;
  courtSport: string;
  slot: string;
  hourlyRate: number;
}

// ── Constants ─────────────────────────────────────────────────

// Slots cada 30 min — mínimo común denominador de 60/90/120 min.
// Con SLOT_GRID_DURATION=30, una reserva de 10:00-11:30 ocupa exactamente
// los slots 10:00, 10:30 y 11:00, dejando 11:30 libre.
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

// Ventana temporal de cada celda — 30 min para solapamiento correcto
const SLOT_GRID_DURATION = 30;

const SLOT_DURATION_OPTIONS = [60, 90, 120] as const;
type SlotDuration = typeof SLOT_DURATION_OPTIONS[number];

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenis", padel: "Pádel", rugby: "Rugby",
  football: "Fútbol", basketball: "Básquet", hockey: "Hockey", other: "Otro",
};

const SPORT_COLORS: Record<string, string> = {
  tennis:     "bg-yellow-100 text-yellow-700",
  padel:      "bg-blue-100 text-blue-700",
  rugby:      "bg-green-100 text-green-700",
  football:   "bg-emerald-100 text-emerald-700",
  basketball: "bg-orange-100 text-orange-700",
  hockey:     "bg-violet-100 text-violet-700",
  other:      "bg-gray-100 text-gray-600",
};

const STATUS_CONFIG = {
  confirmed: { label: "Confirmada", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  pending:   { label: "Pendiente",  bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700"   },
  cancelled: { label: "Cancelada",  bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-400",    dot: "bg-gray-300",   badge: "bg-gray-100 text-gray-500"    },
  completed: { label: "Completada", bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-500",   dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-600"  },
};

// ── Helpers ───────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function toDateString(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function isToday(d: Date): boolean {
  return toDateString(d) === toDateString(new Date());
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function durationMinutes(r: Reservation): number {
  return Math.round(
    (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000
  );
}

/**
 * Detecta solapamiento real de rangos.
 * Una reserva de 90 min (08:00-09:30) aparece en los slots 08:00 y 09:00.
 */
function getReservationForSlot(
  reservations: Reservation[],
  courtId: string,
  slot: string,
): Reservation | undefined {
  const slotStart = timeToMinutes(slot);
  const slotEnd   = slotStart + SLOT_GRID_DURATION;
  return reservations.find((r) => {
    if (r.court_id !== courtId) return false;
    const resStart = timeToMinutes(toLocalTime(r.starts_at));
    const resEnd   = timeToMinutes(toLocalTime(r.ends_at));
    return resStart < slotEnd && resEnd > slotStart;
  });
}

function buildSlotDate(date: Date, slot: string): Date {
  const [h, m] = slot.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60 * 1000);
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
  const { activeClub, isLoading: sessionLoading } = useClubSession();

  // ── Data state ─────────────────────────────────────────────
  const [courts,       setCourts]       = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [memberUsers,  setMemberUsers]  = useState<MemberUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Historial state ────────────────────────────────────────
  const [historialData,    setHistorialData]    = useState<Reservation[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError,   setHistorialError]   = useState<string | null>(null);

  // ── Filter / nav state ─────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSport,  setFilterSport]  = useState<string | null>(null);

  // ── Create modal state ─────────────────────────────────────
  const [selectedSlot,   setSelectedSlot]   = useState<SelectedSlot | null>(null);
  const [slotDuration,   setSlotDuration]   = useState<SlotDuration>(60);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [notes,          setNotes]          = useState<string>("");
  const [isSaving,       setIsSaving]       = useState(false);
  const [modalError,     setModalError]     = useState<string | null>(null);

  // ── Detail / cancel modal state ────────────────────────────
  const [detailRes,     setDetailRes]     = useState<Reservation | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [isCancelling,  setIsCancelling]  = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  // ── Success toast ──────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    setError(null);
    try {
      const [courtsData, resData, membersData] = await Promise.all([
        (courtsApi.list() as unknown) as Promise<Court[]>,
        (reservationsApi.list({ date: toDateString(selectedDate) }) as unknown) as Promise<Reservation[]>,
        membersApi.list({ pageSize: 200 }),
      ]);

      setCourts(courtsData);
      setReservations(resData.filter((r) => r.status !== "cancelled"));
      setMemberUsers(
        membersData.items.map((u) => ({
          id:            u.id,
          first_name:    u.first_name,
          last_name:     u.last_name,
          member_number: u.member_number ?? null,
        }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeClub]);

  const fetchHistorial = useCallback(async () => {
    if (!activeClub) return;
    setHistorialLoading(true);
    setHistorialError(null);
    try {
      const data = (await reservationsApi.list({ status: "completed", allDates: true }) as unknown) as Reservation[];
      setHistorialData(data);
    } catch (e: unknown) {
      setHistorialError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setHistorialLoading(false);
    }
  }, [activeClub]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (filterStatus === "completed") fetchHistorial();
  }, [filterStatus, fetchHistorial]);

  // ── Derived state ──────────────────────────────────────────

  const availableSports = Array.from(new Set(courts.map((c) => c.sport))).sort();
  const visibleCourts   = filterSport ? courts.filter((c) => c.sport === filterSport) : courts;
  const visibleReservations = reservations.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSport && !visibleCourts.find((c) => c.id === r.court_id)) return false;
    return true;
  });

  const stats = {
    total:     reservations.length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    pending:   reservations.filter((r) => r.status === "pending").length,
    completed: reservations.filter((r) => r.status === "completed").length,
  };

  const showHistorial = filterStatus === "completed";

  // ── Navigation ─────────────────────────────────────────────

  function prevDay() { setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function nextDay() { setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToday() { setSelectedDate(new Date()); }

  // ── Create modal handlers ──────────────────────────────────

  function handleOpenModal(court: Court, slot: string) {
    setSelectedSlot({ courtId: court.id, courtName: court.name, courtSport: court.sport, slot, hourlyRate: court.hourly_rate });
    setSlotDuration(60);
    setSelectedUserId(memberUsers[0]?.id ?? "");
    setNotes("");
    setModalError(null);
  }

  function handleCloseModal() {
    if (isSaving) return;
    setSelectedSlot(null);
    setModalError(null);
  }

  async function handleConfirmReservation() {
    if (!selectedSlot || !selectedUserId) {
      setModalError("Seleccioná un socio para la reserva.");
      return;
    }

    const startsDate = buildSlotDate(selectedDate, selectedSlot.slot);
    const endsDate   = addMinutes(startsDate, slotDuration);

    setIsSaving(true);
    setModalError(null);

    try {
      await reservationsApi.create({
        court_id:    selectedSlot.courtId,
        user_id:     selectedUserId,
        starts_at:   startsDate.toISOString(),
        ends_at:     endsDate.toISOString(),
        total_price: parseFloat((selectedSlot.hourlyRate * slotDuration / 60).toFixed(2)),
        notes:       notes.trim() || undefined,
      });
      handleCloseModal();
      const member = memberUsers.find((u) => u.id === selectedUserId);
      const memberName = member ? `${member.first_name} ${member.last_name}` : "Socio";
      setSuccessMsg(`Turno reservado · ${selectedSlot.courtName} ${selectedSlot.slot} · ${memberName}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      if (msg.includes("409") || msg.toLowerCase().includes("overlap") || msg.toLowerCase().includes("ocupado")) {
        setModalError("Horario ocupado: ese slot ya tiene una reserva.");
      } else {
        setModalError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  // ── Detail / cancel handlers ───────────────────────────────

  function handleOpenDetail(res: Reservation) {
    setDetailRes(res);
    setCancelConfirm(false);
    setCancelError(null);
  }

  function handleCloseDetail() {
    if (isCancelling) return;
    setDetailRes(null);
    setCancelConfirm(false);
    setCancelError(null);
  }

  async function handleCancelReservation() {
    if (!detailRes) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await reservationsApi.cancel(detailRes.id);
      handleCloseDetail();
      setSuccessMsg(`Turno cancelado · ${detailRes.court_name} · ${detailRes.user_name}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "Error al cancelar la reserva.");
    } finally {
      setIsCancelling(false);
    }
  }

  // ── Modal derived values ───────────────────────────────────

  const slotEndTime = selectedSlot
    ? addMinutes(buildSlotDate(selectedDate, selectedSlot.slot), slotDuration)
        .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  const totalPrice = selectedSlot
    ? parseFloat((selectedSlot.hourlyRate * slotDuration / 60).toFixed(2))
    : 0;

  // ── Empty state when no club active ────────────────────────

  if (!sessionLoading && !activeClub) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="rounded-full bg-gray-100 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">Sin club activo</p>
        <p className="mt-1 text-xs text-gray-400">Seleccioná un club para ver sus reservas.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Success toast ───────────────────────────────────── */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="ml-2 text-emerald-400 hover:text-emerald-600 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {loading
              ? "Cargando…"
              : `${stats.total} turno${stats.total !== 1 ? "s" : ""} · ${isToday(selectedDate) ? "hoy" : formatDisplayDate(selectedDate)}`}
          </p>
        </div>
        <button
          onClick={() => { const c = visibleCourts[0]; if (c) handleOpenModal(c, TIME_SLOTS[0]); }}
          disabled={loading || visibleCourts.length === 0 || showHistorial}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva reserva
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
      )}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">

          {/* Navegación de fecha — oculta en historial */}
          {!showHistorial && (
            <>
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
            </>
          )}

          {[
            { key: null,        icon: <LayoutGrid   className="h-3.5 w-3.5" />, label: "Todos",       count: stats.total,     countCls: "bg-gray-100 text-gray-500"     },
            { key: "confirmed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Confirmadas", count: stats.confirmed, countCls: "bg-emerald-50 text-emerald-600" },
            { key: "pending",   icon: <Clock        className="h-3.5 w-3.5" />, label: "Pendientes",  count: stats.pending,   countCls: "bg-amber-50 text-amber-600"    },
            { key: "completed", icon: <History      className="h-3.5 w-3.5" />, label: "Historial",   count: null,            countCls: ""                              },
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
                {count !== null && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/20 text-white" : countCls}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtros por deporte — solo en vista de grilla */}
        {!showHistorial && !loading && availableSports.length > 1 && (
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
              return (
                <button
                  key={sport}
                  onClick={() => setFilterSport(active ? null : sport)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${active ? "text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  style={active ? { backgroundColor: "var(--color-brand)" } : {}}
                >
                  {SPORT_LABELS[sport] ?? sport}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          VISTA HISTORIAL — Lista multi-fecha de turnos completados
      ════════════════════════════════════════════════════════ */}
      {showHistorial ? (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          {historialLoading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">Cargando historial…</div>
          ) : historialError ? (
            <div className="px-6 py-8 text-center text-sm text-red-500">{historialError}</div>
          ) : historialData.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <History className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No hay turnos completados todavía.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Fecha</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Cancha</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Socio</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Horario</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historialData.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleOpenDetail(r)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500 tabular-nums">{toLocalDate(r.starts_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-900">{r.court_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                          <span className="text-[9px] font-bold text-gray-500">{initials(r.user_name)}</span>
                        </div>
                        <span className="text-sm text-gray-700">{r.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm tabular-nums text-gray-700">
                        {toLocalTime(r.starts_at)} – {toLocalTime(r.ends_at)}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">{durationMinutes(r)} min</span>
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
          {!historialLoading && historialData.length > 0 && (
            <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">{historialData.length} turno{historialData.length !== 1 ? "s" : ""} completado{historialData.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-400 tabular-nums">
                Total recaudado: ${historialData.reduce((s, r) => s + Number(r.total_price), 0).toLocaleString("es-AR")}
              </p>
            </div>
          )}
        </div>
      ) : (

      /* ════════════════════════════════════════════════════════
          VISTA GRILLA — Por día
      ════════════════════════════════════════════════════════ */
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-400 w-20">Horario</th>
                {loading
                  ? [1, 2, 3].map((i) => (
                      <th key={i} className="px-4 py-4 border-l border-gray-50">
                        <div className="h-3 w-24 animate-pulse rounded bg-gray-100 mx-auto" />
                      </th>
                    ))
                  : visibleCourts.map((court) => (
                      <th key={court.id} className="px-4 py-4 text-center border-l border-gray-50 min-w-[160px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">{court.name}</span>
                          <div className="flex items-center gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SPORT_COLORS[court.sport] ?? "bg-gray-100 text-gray-500"}`}>
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
                    <td className="px-4 py-2 border-r border-gray-50 tabular-nums text-xs font-medium text-gray-400 w-20">{slot}</td>
                    {visibleCourts.map((court) => {
                      const res = getReservationForSlot(visibleReservations, court.id, slot);
                      const cfg = res ? STATUS_CONFIG[res.status] : null;
                      return (
                        <td key={`${court.id}-${slot}`} className="p-2 border-l border-gray-50">
                          {res && cfg ? (
                            <button
                              onClick={() => handleOpenDetail(res)}
                              className={`w-full rounded-lg border px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer transition hover:brightness-95 text-left ${cfg.bg} ${cfg.border}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <span className={`text-xs font-semibold truncate ${cfg.text}`}>{res.user_name}</span>
                              </div>
                              {res.notes && (
                                <span className="text-[10px] text-gray-400 truncate pl-3">{res.notes}</span>
                              )}
                              <span className={`text-[10px] pl-3 ${cfg.text} opacity-70`}>
                                {toLocalTime(res.starts_at)} – {toLocalTime(res.ends_at)}
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenModal(court, slot)}
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
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL — Nueva reserva
      ════════════════════════════════════════════════════════ */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseModal} />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 flex-shrink-0">
                  <Timer className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Nueva reserva</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedSlot.courtName} · {selectedDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isSaving}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer disabled:opacity-40 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Slot info */}
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Horario seleccionado</p>
                  <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                    {selectedSlot.slot}
                    <span className="text-gray-300 font-light mx-2">→</span>
                    {slotEndTime}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SPORT_COLORS[selectedSlot.courtSport] ?? "bg-gray-100 text-gray-600"}`}>
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

            {/* Duración */}
            <div className="px-6 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Duración</p>
              <div className="flex gap-2">
                {SLOT_DURATION_OPTIONS.map((d) => {
                  const price = parseFloat((selectedSlot.hourlyRate * d / 60).toFixed(2));
                  const active = slotDuration === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setSlotDuration(d)}
                      disabled={isSaving}
                      className={`flex-1 rounded-xl border-2 py-2.5 text-center transition cursor-pointer disabled:opacity-40 ${
                        active ? "text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                      style={active ? { backgroundColor: "var(--color-brand)", borderColor: "var(--color-brand)" } : {}}
                    >
                      <div className="text-sm font-bold">{d} min</div>
                      {price > 0 && (
                        <div className={`text-xs mt-0.5 ${active ? "text-white/60" : "text-gray-400"}`}>
                          ${price.toLocaleString("es-AR")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formulario */}
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
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60 cursor-pointer"
                  >
                    <option value="" disabled>Seleccioná un socio…</option>
                    {memberUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}{u.member_number ? ` · N° ${u.member_number}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-400 italic">No se pudieron cargar los socios. Recargá la página.</p>
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
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSaving}
                  placeholder="Ej: clase con profe, turno fijo…"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60"
                />
              </div>

              {modalError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{modalError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={handleCloseModal}
                disabled={isSaving}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReservation}
                disabled={isSaving || !selectedUserId}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--color-brand)" }}
              >
                {isSaving ? "Reservando…" : "Confirmar turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL — Detalle + cancelación de turno
      ════════════════════════════════════════════════════════ */}
      {detailRes && (() => {
        const cfg = STATUS_CONFIG[detailRes.status] ?? STATUS_CONFIG.confirmed;
        const ini = initials(detailRes.user_name);
        const canCancel = detailRes.status !== "cancelled" && detailRes.status !== "completed";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={handleCloseDetail} />

            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{detailRes.court_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {toLocalDate(detailRes.starts_at)}
                  </p>
                </div>
                <button
                  onClick={handleCloseDetail}
                  disabled={isCancelling}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer mt-0.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Horario prominente */}
              <div className="px-6 pt-4">
                <div className={`rounded-xl border px-4 py-3.5 ${cfg.bg} ${cfg.border}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${cfg.text} opacity-70`}>Horario</p>
                  <p className={`text-2xl font-black tabular-nums leading-none ${cfg.text}`}>
                    {toLocalTime(detailRes.starts_at)}
                    <span className="font-light opacity-40 mx-2">→</span>
                    {toLocalTime(detailRes.ends_at)}
                  </p>
                  <p className={`text-xs mt-1 ${cfg.text} opacity-60`}>
                    {durationMinutes(detailRes)} minutos
                  </p>
                </div>
              </div>

              {/* Cuerpo */}
              <div className="px-6 pt-4 pb-2 space-y-3">

                {/* Socio + importe */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-600">{ini}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{detailRes.user_name}</p>
                    <p className="text-xs text-gray-400">Socio</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {Number(detailRes.total_price).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400">
                      pagado ${Number(detailRes.paid_amount).toLocaleString("es-AR")}
                    </p>
                  </div>
                </div>

                {/* Notas */}
                {detailRes.notes && (
                  <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{detailRes.notes}</p>
                  </div>
                )}

                {/* Error de cancelación */}
                {cancelError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{cancelError}</p>
                  </div>
                )}

                {/* Confirmación inline */}
                {cancelConfirm && canCancel && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm font-semibold text-amber-800">¿Cancelar este turno?</p>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">El horario queda disponible. No se puede deshacer.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelConfirm(false)}
                        disabled={isCancelling}
                        className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                      >
                        No, mantener
                      </button>
                      <button
                        onClick={handleCancelReservation}
                        disabled={isCancelling}
                        className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition cursor-pointer disabled:opacity-60"
                      >
                        {isCancelling ? "Cancelando…" : "Sí, cancelar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  onClick={handleCloseDetail}
                  disabled={isCancelling}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer"
                >
                  Cerrar
                </button>
                {canCancel && !cancelConfirm && (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition cursor-pointer"
                  >
                    <Ban className="h-4 w-4" />
                    Cancelar turno
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
