"use client";
// apps/web/app/(dashboard)/courts/page.tsx
//
// Gestión de infraestructura física del club (canchas).
//
// Datos:    courtsApi (GET /courts, POST, PUT, DELETE)
// Sesión:   useClubSession() → activeClub, hasRole
// Tipos:    CourtOut, CourtCreate, CourtUpdate (de lib/api.ts)
//
// Flujos:
//  · Crear cancha  → botón "Nueva cancha" (OWNER) → modal → POST → prepend local
//  · Editar cancha → ícono ✏ (OWNER) → modal pre-relleno → PUT → actualiza card
//  · Eliminar      → ícono 🗑 (OWNER) → confirmación inline → DELETE → elimina local
//
// Accesos:
//  · Lista → todos los roles autenticados
//  · Crear / Editar / Eliminar → solo OWNER

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  DollarSign,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Sun,
  Trash2,
  Trophy,
  Users,
  Wind,
  X,
} from "lucide-react";

import { ActionButton } from "@/components/ui/action-button";
import { useClubSession } from "@/contexts/ClubSessionContext";
import {
  courtsApi,
  type CourtCreate,
  type CourtOut,
  type CourtUpdate,
} from "@/lib/api";

// ── Catálogos ──────────────────────────────────────────────────────────────

interface SportConfig {
  label:    string;
  icon:     React.ReactNode;
  badgeCls: string;
}

const SPORTS: Record<string, SportConfig> = {
  tennis:     { label: "Tenis",    icon: <Activity className="h-4 w-4" />, badgeCls: "border-blue-200 bg-blue-50 text-blue-700"         },
  padel:      { label: "Pádel",   icon: <Layers   className="h-4 w-4" />, badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  football:   { label: "Fútbol",  icon: <Trophy   className="h-4 w-4" />, badgeCls: "border-green-200 bg-green-50 text-green-700"       },
  rugby:      { label: "Rugby",   icon: <Shield   className="h-4 w-4" />, badgeCls: "border-orange-200 bg-orange-50 text-orange-700"    },
  hockey:     { label: "Hockey",  icon: <Wind     className="h-4 w-4" />, badgeCls: "border-red-200 bg-red-50 text-red-700"             },
  basketball: { label: "Básquet", icon: <Sun      className="h-4 w-4" />, badgeCls: "border-yellow-200 bg-yellow-50 text-yellow-700"    },
  other:      { label: "Otro",    icon: <Activity className="h-4 w-4" />, badgeCls: "border-border bg-muted text-muted-foreground"      },
};

const SPORT_OPTIONS = Object.entries(SPORTS).map(([value, { label }]) => ({ value, label }));

const SURFACE_OPTIONS = [
  { value: "clay",      label: "Polvo de ladrillo" },
  { value: "concrete",  label: "Cemento"            },
  { value: "synthetic", label: "Sintético"          },
  { value: "grass",     label: "Césped natural"     },
  { value: "carpet",    label: "Moqueta"            },
  { value: "hardwood",  label: "Madera"             },
  { value: "other",     label: "Otro"               },
];

// ── Types ──────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; court: CourtOut }
  | null;

type ToastState = { message: string; type: "success" | "error" } | null;

// ── Helpers ───────────────────────────────────────────────────────────────

function sportConfig(sport: string): SportConfig {
  return SPORTS[sport] ?? SPORTS.other;
}

function surfaceLabel(surface: string | null): string {
  if (!surface) return "—";
  return SURFACE_OPTIONS.find((s) => s.value === surface)?.label ?? surface;
}

function fmtRate(rate: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(rate);
}

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ state }: { state: ToastState }) {
  if (!state) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
        state.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-destructive/20 bg-destructive/10 text-destructive"
      }`}
    >
      {state.type === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {state.message}
    </div>
  );
}

// ── CourtFormModal ─────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  sport:       string;
  surface:     string;
  is_indoor:   boolean;
  capacity:    string;
  hourly_rate: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name:        "",
  sport:       "tennis",
  surface:     "synthetic",
  is_indoor:   false,
  capacity:    "2",
  hourly_rate: "",
  description: "",
};

function CourtFormModal({
  modal,
  onClose,
  onSave,
}: {
  modal:   NonNullable<ModalState>;
  onClose: () => void;
  onSave:  (payload: CourtCreate | CourtUpdate, id?: string) => Promise<void>;
}) {
  const isEdit   = modal.mode === "edit";
  const editItem = isEdit ? (modal as { mode: "edit"; court: CourtOut }).court : null;

  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editItem) {
      setForm({
        name:        editItem.name,
        sport:       editItem.sport,
        surface:     editItem.surface ?? "other",
        is_indoor:   editItem.is_indoor,
        capacity:    String(editItem.capacity),
        hourly_rate: String(editItem.hourly_rate),
        description: editItem.description ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setFormError(null);
    setTimeout(() => firstRef.current?.focus(), 60);
  }, [editItem?.id]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rate = parseFloat(form.hourly_rate);
    const cap  = parseInt(form.capacity, 10);
    if (!form.name.trim())       return setFormError("El nombre es obligatorio");
    if (isNaN(rate) || rate < 0) return setFormError("Ingresá un precio por hora válido");
    if (isNaN(cap)  || cap  < 1) return setFormError("La capacidad debe ser al menos 1");

    const payload: CourtCreate = {
      name:        form.name.trim(),
      sport:       form.sport,
      surface:     form.surface || null,
      is_indoor:   form.is_indoor,
      capacity:    cap,
      hourly_rate: rate,
      description: form.description.trim() || null,
    };

    setSaving(true);
    try {
      await onSave(payload, editItem?.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Editar cancha" : "Nueva cancha"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <input
              ref={firstRef}
              value={form.name}
              onChange={set("name")}
              placeholder="Ej: Cancha 1"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>

          {/* Deporte + Superficie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Deporte</label>
              <select
                value={form.sport}
                onChange={set("sport")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              >
                {SPORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Superficie</label>
              <select
                value={form.surface}
                onChange={set("surface")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              >
                {SURFACE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Precio + Capacidad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Precio / hora (ARS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.hourly_rate}
                onChange={set("hourly_rate")}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Capacidad</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={set("capacity")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              />
            </div>
          </div>

          {/* Indoor toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.is_indoor}
                onChange={(e) => setForm((prev) => ({ ...prev, is_indoor: e.target.checked }))}
                className="sr-only"
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors ${form.is_indoor ? "bg-primary" : "bg-muted"}`}
              />
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${form.is_indoor ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-sm text-foreground">Cancha cubierta (indoor)</span>
          </label>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={set("description")}
              rows={2}
              placeholder="Notas adicionales sobre esta cancha…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>

          {/* Error */}
          {formError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isEdit ? "Guardar cambios" : "Crear cancha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CourtCard ──────────────────────────────────────────────────────────────

function CourtCard({
  court,
  isOwner,
  onEdit,
  onDelete,
  confirmId,
  onConfirmDelete,
  onCancelDelete,
}: {
  court:           CourtOut;
  isOwner:         boolean;
  onEdit:          (c: CourtOut) => void;
  onDelete:        (c: CourtOut) => void;
  confirmId:       string | null;
  onConfirmDelete: (c: CourtOut) => void;
  onCancelDelete:  () => void;
}) {
  const sport = sportConfig(court.sport);
  const isPendingDelete = confirmId === court.id;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-border/80 hover:shadow-sm">
      {/* Sport color bar */}
      <div className={`h-1 w-full ${sport.badgeCls.split(" ")[1]}`} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{court.name}</h3>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${sport.badgeCls}`}
            >
              {sport.icon}
              {sport.label}
            </span>
          </div>

          {/* Actions — only for OWNER */}
          {isOwner && (
            <div className="flex shrink-0 items-center gap-1">
              {isPendingDelete ? (
                <>
                  <span className="mr-1 text-xs text-muted-foreground">¿Eliminar?</span>
                  <button
                    onClick={() => onConfirmDelete(court)}
                    className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition cursor-pointer"
                  >
                    Sí
                  </button>
                  <button
                    onClick={onCancelDelete}
                    className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onEdit(court)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(court)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5">
            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Superficie</p>
              <p className="truncate text-xs font-medium text-foreground">{surfaceLabel(court.surface)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Capacidad</p>
              <p className="text-xs font-medium text-foreground">{court.capacity} personas</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${court.is_indoor ? "bg-blue-400" : "bg-emerald-400"}`}
            />
            <span className="text-xs text-muted-foreground">{court.is_indoor ? "Cubierta" : "Al aire libre"}</span>
          </div>
          <div className="flex items-center gap-1 text-foreground">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">{fmtRate(court.hourly_rate)}</span>
            <span className="text-xs text-muted-foreground">/h</span>
          </div>
        </div>

        {/* Optional description */}
        {court.description && (
          <p className="text-xs text-muted-foreground leading-relaxed -mt-1 line-clamp-2">
            {court.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CourtsPage() {
  const { activeClub, isLoading: sessionLoading, hasRole } = useClubSession();
  const isOwner = hasRole("OWNER");

  const [courts,    setCourts]    = useState<CourtOut[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [modal,        setModal]        = useState<ModalState>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [toast,        setToast]        = useState<ToastState>(null);
  const [filterSport,  setFilterSport]  = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchCourts = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    setError(null);
    try {
      const data = await courtsApi.list();
      setCourts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las canchas");
    } finally {
      setLoading(false);
    }
  }, [activeClub?.clubId]);

  useEffect(() => { fetchCourts(); }, [fetchCourts]);

  const handleSave = async (payload: CourtCreate | CourtUpdate, editId?: string) => {
    if (editId) {
      const updated = await courtsApi.update(editId, payload as CourtUpdate);
      setCourts((prev) => prev.map((c) => (c.id === editId ? updated : c)));
      showToast("Cancha actualizada");
    } else {
      const created = await courtsApi.create(payload as CourtCreate);
      setCourts((prev) => [created, ...prev]);
      showToast("Cancha creada");
    }
  };

  const handleDeleteRequest = (court: CourtOut) => setConfirmId(court.id);
  const handleDeleteCancel  = () => setConfirmId(null);

  const handleDeleteConfirm = async (court: CourtOut) => {
    try {
      await courtsApi.remove(court.id);
      setCourts((prev) => prev.filter((c) => c.id !== court.id));
      showToast("Cancha eliminada");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setConfirmId(null);
    }
  };

  if (!sessionLoading && !activeClub) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-foreground">Canchas</h1>
        <p className="mt-8 text-center text-sm text-muted-foreground">No hay ningún club activo.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Canchas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? "Cargando…"
              : `${courts.length} cancha${courts.length !== 1 ? "s" : ""} registrada${courts.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>

        {isOwner && (
          <ActionButton icon={Plus} onClick={() => setModal({ mode: "create" })}>
            Nueva cancha
          </ActionButton>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      )}

      {/* Sport filter */}
      {!loading && courts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterSport(null)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              filterSport === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {[...new Set(courts.map((c) => c.sport))].map((sport) => {
            const { label, badgeCls } = sportConfig(sport);
            const isActive = filterSport === sport;
            return (
              <button
                key={sport}
                onClick={() => { if (!isActive) setFilterSport(sport); }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? badgeCls + " ring-1 ring-inset ring-current"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {!loading && courts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.filter((c) => filterSport === null || c.sport === filterSport).map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              isOwner={isOwner}
              onEdit={(c) => setModal({ mode: "edit", court: c })}
              onDelete={handleDeleteRequest}
              confirmId={confirmId}
              onConfirmDelete={handleDeleteConfirm}
              onCancelDelete={handleDeleteCancel}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && courts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Layers className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No hay canchas registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isOwner ? "Agregá la primera cancha para comenzar." : "El propietario aún no registró canchas."}
          </p>
          {isOwner && (
            <ActionButton icon={Plus} className="mt-5" onClick={() => setModal({ mode: "create" })}>
              Nueva cancha
            </ActionButton>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CourtFormModal
          modal={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <Toast state={toast} />
    </div>
  );
}
