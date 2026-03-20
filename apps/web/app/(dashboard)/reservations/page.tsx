"use client";
// apps/web/app/(dashboard)/reservations/page.tsx
//
// Orquestador del módulo de Reservas.
// Estado, fetching, handlers y composición de subcomponentes.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  History,
  LayoutGrid,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { courtsApi, membersApi, reservationsApi } from "@/lib/api";
import { useClubSession }                         from "@/contexts/ClubSessionContext";

import { CreateReservationModal }  from "./components/CreateReservationModal";
import { HistorialView }           from "./components/HistorialView";
import { ReservationDetailModal }  from "./components/ReservationDetailModal";
import { ReservationGrid }         from "./components/ReservationGrid";
import { WeekStrip }               from "./components/WeekStrip";
import { SPORT_LABELS }            from "./components/constants";
import {
  addMinutes,
  buildSlotDate,
  formatDisplayDate,
  isToday,
  toDateString,
  toLocalTime,
} from "./components/helpers";
import type { Court, MemberUser, Reservation, SelectedSlot, SlotDuration } from "./components/types";

// ── Export helpers ───────────────────────────────────────────────────────────

type ExportPeriod = "day" | "week" | "month";

function startOfWeek(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function endOfWeek(d: Date): Date {
  const sun = startOfWeek(d);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function downloadReservationsCsv(data: Reservation[], period: ExportPeriod, refDate: Date): void {
  const PERIOD_LABEL: Record<ExportPeriod, string> = {
    day:   "dia",
    week:  "semana",
    month: "mes",
  };

  const rows: string[][] = [
    ["Fecha", "Hora inicio", "Hora fin", "Cancha", "Socio", "Estado", "Importe", "Pagado"],
    ...data.map((r) => [
      new Date(r.starts_at).toLocaleDateString("es-AR"),
      toLocalTime(r.starts_at),
      toLocalTime(r.ends_at),
      r.court_name,
      r.user_name,
      r.status,
      Number(r.total_price).toFixed(2),
      Number(r.paid_amount).toFixed(2),
    ]),
    [],
    ["", "", "", "", "", "TOTAL", data.reduce((s, r) => s + Number(r.total_price), 0).toFixed(2), ""],
  ];

  const csv  = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `reservas-${PERIOD_LABEL[period]}-${toDateString(refDate)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const { activeClub, isLoading: sessionLoading } = useClubSession();

  // ── Data state ─────────────────────────────────────────────────────────
  const [courts,       setCourts]       = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [memberUsers,  setMemberUsers]  = useState<MemberUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Historial state ────────────────────────────────────────────────────
  const [historialData,    setHistorialData]    = useState<Reservation[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError,   setHistorialError]   = useState<string | null>(null);

  // ── Filtros y navegación ───────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSport,  setFilterSport]  = useState<string | null>(null);

  // ── Export ────────────────────────────────────────────────────────────
  const [exportOpen,   setExportOpen]   = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── Modal de creación ──────────────────────────────────────────────────
  const [selectedSlot,   setSelectedSlot]   = useState<SelectedSlot | null>(null);
  const [slotDuration,   setSlotDuration]   = useState<SlotDuration>(60);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [notes,          setNotes]          = useState<string>("");
  const [isSaving,       setIsSaving]       = useState(false);
  const [modalError,     setModalError]     = useState<string | null>(null);

  // ── Modal de detalle / cancelación ────────────────────────────────────
  const [detailRes,     setDetailRes]     = useState<Reservation | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [isCancelling,  setIsCancelling]  = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

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
        })),
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
      const data = (
        await reservationsApi.list({ status: "completed", allDates: true })
      ) as unknown as Reservation[];
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

  // ── Export handler ────────────────────────────────────────────────────

  async function handleExport(period: ExportPeriod) {
    setExportOpen(false);
    setExporting(true);
    try {
      let data: Reservation[];

      if (period === "day") {
        // Datos del día ya están en memoria
        data = reservations;
      } else {
        // Fetch completo y filtrar por rango
        const all = (
          await reservationsApi.list({ allDates: true })
        ) as unknown as Reservation[];

        const [start, end] = period === "week"
          ? [startOfWeek(selectedDate), endOfWeek(selectedDate)]
          : [startOfMonth(selectedDate), endOfMonth(selectedDate)];

        data = all.filter((r) => {
          const d = new Date(r.starts_at);
          return d >= start && d <= end;
        });
      }

      downloadReservationsCsv(data, period, selectedDate);
    } catch {
      // silencioso — raramente falla un fetch all_dates
    } finally {
      setExporting(false);
    }
  }

  // ── Estado derivado ────────────────────────────────────────────────────

  const availableSports = Array.from(new Set(courts.map((c) => c.sport))).sort();

  const visibleCourts = filterSport
    ? courts.filter((c) => c.sport === filterSport)
    : courts;

  const visibleReservations = reservations.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSport && !visibleCourts.find((c) => c.id === r.court_id)) return false;
    return true;
  });

  const stats = {
    total:     reservations.length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    pending:   reservations.filter((r) => r.status === "pending").length,
    revenue:   reservations.reduce((s, r) => s + Number(r.total_price), 0),
  };

  const showHistorial = filterStatus === "completed";

  // ── Handlers: modal de creación ────────────────────────────────────────

  function handleOpenModal(court: Court, slot: string) {
    setSelectedSlot({
      courtId:    court.id,
      courtName:  court.name,
      courtSport: court.sport,
      slot,
      hourlyRate: court.hourly_rate,
    });
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
      const member     = memberUsers.find((u) => u.id === selectedUserId);
      const memberName = member ? `${member.first_name} ${member.last_name}` : "Socio";
      setSuccessMsg(`Turno reservado · ${selectedSlot.courtName} ${selectedSlot.slot} · ${memberName}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      if (
        msg.includes("409") ||
        msg.toLowerCase().includes("overlap") ||
        msg.toLowerCase().includes("ocupado")
      ) {
        setModalError("Horario ocupado: ese slot ya tiene una reserva.");
      } else {
        setModalError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  // ── Handlers: modal de detalle / cancelación ───────────────────────────

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

  // ── Guard: sin club activo ─────────────────────────────────────────────

  if (!sessionLoading && !activeClub) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-sm font-medium text-gray-600">Sin club activo</p>
        <p className="mt-1 text-xs text-gray-400">
          Seleccioná un club para ver sus reservas.
        </p>
      </div>
    );
  }

  // ── Tabs de estado ─────────────────────────────────────────────────────

  const STATUS_TABS = [
    { key: null,        icon: <LayoutGrid   className="h-3.5 w-3.5" />, label: "Todos",       count: stats.total,     countCls: "bg-gray-100 text-gray-500"     },
    { key: "confirmed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Confirmadas", count: stats.confirmed, countCls: "bg-emerald-50 text-emerald-600" },
    { key: "pending",   icon: <Clock        className="h-3.5 w-3.5" />, label: "Pendientes",  count: stats.pending,   countCls: "bg-amber-50 text-amber-600"    },
    { key: "completed", icon: <History      className="h-3.5 w-3.5" />, label: "Historial",   count: null,            countCls: ""                              },
  ] as const;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-5">

      {/* Toast de éxito */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMsg}</p>
          <button
            onClick={() => setSuccessMsg(null)}
            className="ml-2 text-emerald-400 hover:text-emerald-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {loading
              ? "Cargando…"
              : `${stats.total} turno${stats.total !== 1 ? "s" : ""} · ${
                  isToday(selectedDate) ? "hoy" : formatDisplayDate(selectedDate)
                }`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
            >
              {exporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              Exportar
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                  {(["day", "week", "month"] as ExportPeriod[]).map((p, i) => (
                    <button
                      key={p}
                      onClick={() => handleExport(p)}
                      className={`w-full cursor-pointer px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition ${
                        i === 0 ? "rounded-t-xl" : i === 2 ? "rounded-b-xl" : ""
                      }`}
                    >
                      {p === "day" ? "Del día" : p === "week" ? "De la semana" : "Del mes"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Nueva reserva */}
          <button
            onClick={() => {
              const c = visibleCourts[0];
              if (c) handleOpenModal(c, "08:00");
            }}
            disabled={loading || visibleCourts.length === 0 || showHistorial}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            <Plus className="h-4 w-4" />
            Nueva reserva
          </button>
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Stats rápidas (solo vista de grilla) ───────────────────────── */}
      {!showHistorial && (
        <div className="grid grid-cols-3 gap-4">

          {/* Turnos del día */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Turnos</p>
              <div className="rounded-lg bg-gray-50 p-2">
                <LayoutGrid className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : stats.total}
            </p>
            <p className="mt-1 text-xs text-gray-400">del día</p>
          </div>

          {/* Confirmados */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Confirmados</p>
              <div className="rounded-lg bg-emerald-50 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : stats.confirmed}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {!loading && `${stats.pending} pendiente${stats.pending !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Ingresos estimados */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Ingresos estimados</p>
              <div className="rounded-lg bg-gray-50 p-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : `$${stats.revenue.toLocaleString("es-AR")}`}
            </p>
            <p className="mt-1 text-xs text-gray-400">del día</p>
          </div>

        </div>
      )}

      {/* ── Controles: selector semanal + tabs de estado ───────────────── */}
      <div className="flex flex-col gap-4">

        {/* Fila principal: WeekStrip + divisor + pestañas */}
        <div className="flex flex-wrap items-center gap-4">

          {/* Selector semanal (oculto en historial) */}
          {!showHistorial && (
            <>
              <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
              <div className="h-12 w-px bg-gray-100" />
            </>
          )}

          {/* Pestañas de estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map(({ key, icon, label, count, countCls }) => {
              const active = filterStatus === key;
              return (
                <button
                  key={String(key)}
                  onClick={() => setFilterStatus(key)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100"
                  }`}
                  style={active ? { backgroundColor: "var(--color-brand)" } : {}}
                >
                  {icon}
                  {label}
                  {count !== null && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs ${
                        active ? "bg-white/20 text-white" : countCls
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtro por deporte (solo grilla, más de un deporte disponible) */}
        {!showHistorial && !loading && availableSports.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-400">Deporte:</span>
            <button
              onClick={() => setFilterSport(null)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                filterSport === null
                  ? "text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
              style={filterSport === null ? { backgroundColor: "var(--color-brand)" } : {}}
            >
              Todos
            </button>
            {availableSports.map((sport) => {
              const active = filterSport === sport;
              return (
                <button
                  key={sport}
                  onClick={() => setFilterSport(sport)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    active
                      ? "text-white"
                      : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                  style={active ? { backgroundColor: "var(--color-brand)" } : {}}
                >
                  {SPORT_LABELS[sport] ?? sport}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Contenido principal ────────────────────────────────────────── */}
      {showHistorial ? (
        <HistorialView
          data={historialData}
          loading={historialLoading}
          error={historialError}
          onRowClick={handleOpenDetail}
        />
      ) : (
        <ReservationGrid
          courts={visibleCourts}
          reservations={visibleReservations}
          loading={loading}
          onSlotClick={handleOpenModal}
          onCellClick={handleOpenDetail}
        />
      )}

      {/* ── Modal: nueva reserva ───────────────────────────────────────── */}
      {selectedSlot && (
        <CreateReservationModal
          selectedSlot={selectedSlot}
          selectedDate={selectedDate}
          slotDuration={slotDuration}
          onDurationChange={setSlotDuration}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
          notes={notes}
          onNotesChange={setNotes}
          memberUsers={memberUsers}
          isSaving={isSaving}
          modalError={modalError}
          onClose={handleCloseModal}
          onConfirm={handleConfirmReservation}
        />
      )}

      {/* ── Modal: detalle / cancelar ──────────────────────────────────── */}
      {detailRes && (
        <ReservationDetailModal
          reservation={detailRes}
          cancelConfirm={cancelConfirm}
          isCancelling={isCancelling}
          cancelError={cancelError}
          onClose={handleCloseDetail}
          onCancelRequest={() => setCancelConfirm(true)}
          onCancelConfirm={handleCancelReservation}
          onCancelAbort={() => setCancelConfirm(false)}
        />
      )}
    </div>
  );
}
