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
//  · Eliminar      → ícono 🗑 (OWNER) → AlertDialog de confirmación → DELETE
//
// Accesos:
//  · Lista → todos los roles autenticados
//  · Crear / Editar / Eliminar → solo OWNER

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
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
import { Button } from "@/components/ui/button";
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

/**
 * Mapa de compatibilidad deporte → superficies válidas.
 * Los deportes ausentes de este mapa aceptan todas las superficies.
 * Invariante de negocio: hockey NO puede jugarse en polvo de ladrillo.
 */
const SPORT_SURFACE_COMPAT: Record<string, string[]> = {
  hockey:     ["synthetic", "grass", "carpet", "other"],
  basketball: ["hardwood",  "concrete", "synthetic", "other"],
  football:   ["grass",     "synthetic", "concrete", "other"],
};

function allowedSurfaces(sport: string): typeof SURFACE_OPTIONS {
  const allowed = SPORT_SURFACE_COMPAT[sport];
  return allowed ? SURFACE_OPTIONS.filter((s) => allowed.includes(s.value)) : SURFACE_OPTIONS;
}

// ── Types ──────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; court: CourtOut }
  | null;

type ToastState = { message: string; type: "success" | "error" } | null;

interface FieldErrors {
  name?:        string;
  hourly_rate?: string;
  capacity?:    string;
}

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

// ── DeleteConfirmDialog (AlertDialog pattern) ──────────────────────────────

function DeleteConfirmDialog({
  court,
  onConfirm,
  onCancel,
}: {
  court:     CourtOut;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Icon + Title + Description */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              ¿Estás seguro de eliminar la cancha &ldquo;{court.name}&rdquo;?
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Esta acción no se puede deshacer y podría afectar a reservas futuras y pasadas.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            <Trash2 />
            Eliminar definitivamente
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── CourtCharacteristicChip ────────────────────────────────────────────────
// Componente abstracto reutilizable para KPIs de tarjeta.
// Garantiza consistencia visual: mismo padding, tipografía y altura en todas las cards.

interface ChipProps {
  icon:    React.ReactNode;
  label:   string;
  value:   string;
  variant: "surface" | "capacity";
}

function CourtCharacteristicChip({ icon, label, value, variant }: ChipProps) {
  const wrapCls =
    variant === "surface"
      ? "bg-blue-50/70 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900"
      : "bg-violet-50/70 border-violet-100 dark:bg-violet-950/30 dark:border-violet-900";

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${wrapCls}`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

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

  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [fieldErrors,  setFieldErrors]  = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
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
    setFieldErrors({});
    setGeneralError(null);
    setTimeout(() => firstRef.current?.focus(), 60);
  }, [editItem?.id]);

  /** Cuando cambia el deporte, reajusta la superficie si no es compatible. */
  const handleSportChange = (sport: string) => {
    const allowed = allowedSurfaces(sport);
    setForm((prev) => ({
      ...prev,
      sport,
      surface: allowed.some((s) => s.value === prev.surface) ? prev.surface : allowed[0].value,
    }));
  };

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const rate = parseFloat(form.hourly_rate);
    const cap  = parseInt(form.capacity, 10);
    const errors: FieldErrors = {};
    if (!form.name.trim())       errors.name        = "El nombre es obligatorio";
    if (isNaN(rate) || rate < 0) errors.hourly_rate = "Ingresá un precio por hora válido";
    if (isNaN(cap)  || cap  < 1) errors.capacity    = "La capacidad debe ser al menos 1";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

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
      setGeneralError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const surfaces             = allowedSurfaces(form.sport);
  const hasSurfaceFilter     = Boolean(SPORT_SURFACE_COMPAT[form.sport]);
  const inputBase            = "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition";
  const inputError           = "border-destructive focus:border-destructive";
  const inputOk              = "border-border focus:border-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-border dark:bg-card">

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

        {/* General error banner — only for API errors */}
        {generalError && (
          <div className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">{generalError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre <span className="text-destructive">*</span>
            </label>
            <input
              ref={firstRef}
              value={form.name}
              onChange={set("name")}
              placeholder="Ej: Cancha 1"
              className={`${inputBase} ${fieldErrors.name ? inputError : inputOk}`}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          {/* Deporte + Superficie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Deporte</label>
              <select
                value={form.sport}
                onChange={(e) => handleSportChange(e.target.value)}
                className={`${inputBase} ${inputOk}`}
              >
                {SPORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Superficie
                {hasSurfaceFilter && (
                  <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-normal text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    filtrada
                  </span>
                )}
              </label>
              <select
                value={form.surface}
                onChange={set("surface")}
                className={`${inputBase} ${inputOk}`}
              >
                {surfaces.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Precio + Capacidad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Precio / hora (ARS) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.hourly_rate}
                onChange={set("hourly_rate")}
                placeholder="0"
                className={`${inputBase} ${fieldErrors.hourly_rate ? inputError : inputOk}`}
              />
              <FieldError message={fieldErrors.hourly_rate} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Capacidad <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={set("capacity")}
                className={`${inputBase} ${fieldErrors.capacity ? inputError : inputOk}`}
              />
              <FieldError message={fieldErrors.capacity} />
            </div>
          </div>

          {/* Cancha cubierta — Switch de Shadcn UI */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cancha cubierta</p>
              <p className="text-xs text-muted-foreground">
                {form.is_indoor ? "Indoor / bajo techo" : "Al aire libre"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_indoor}
              onClick={() => setForm((prev) => ({ ...prev, is_indoor: !prev.is_indoor }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                form.is_indoor ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
                  form.is_indoor ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={set("description")}
              rows={2}
              placeholder="Notas adicionales sobre esta cancha…"
              className={`${inputBase} ${inputOk} resize-none`}
            />
          </div>

          {/* Actions — usa <Button> abstracto */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" />
              ) : isEdit ? (
                <Pencil />
              ) : (
                <Plus />
              )}
              {isEdit ? "Guardar cambios" : "Crear cancha"}
            </Button>
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
  onDeleteRequest,
}: {
  court:           CourtOut;
  isOwner:         boolean;
  onEdit:          (c: CourtOut) => void;
  onDeleteRequest: (c: CourtOut) => void;
}) {
  const sport = sportConfig(court.sport);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-sm">
      {/* Sport color bar — extraída del badgeCls (2.ª clase = bg-*) */}
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

          {/* Acciones — solo OWNER (RBAC) */}
          {isOwner && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onEdit(court)}
                className="rounded-lg p-1.5 text-muted-foreground transition cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                aria-label="Editar cancha"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDeleteRequest(court)}
                className="rounded-lg p-1.5 text-muted-foreground transition cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                aria-label="Eliminar cancha"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* KPIs — CourtCharacteristicChip garantiza DRY y consistencia visual */}
        <div className="grid grid-cols-2 gap-3">
          <CourtCharacteristicChip
            icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}
            label="Superficie"
            value={surfaceLabel(court.surface)}
            variant="surface"
          />
          <CourtCharacteristicChip
            icon={<Users className="h-3.5 w-3.5 text-violet-500" />}
            label="Capacidad"
            value={`${court.capacity} personas`}
            variant="capacity"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${court.is_indoor ? "bg-blue-400" : "bg-emerald-400"}`}
            />
            <span className="text-xs text-muted-foreground">
              {court.is_indoor ? "Cubierta" : "Al aire libre"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-foreground">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">{fmtRate(court.hourly_rate)}</span>
            <span className="text-xs text-muted-foreground">/h</span>
          </div>
        </div>

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

  const [courts,       setCourts]       = useState<CourtOut[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const [modal,        setModal]        = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourtOut | null>(null);
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await courtsApi.remove(deleteTarget.id);
      setCourts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      showToast("Cancha eliminada");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setDeleteTarget(null);
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

        {/* RBAC: solo OWNER puede crear */}
        {isOwner && (
          <ActionButton icon={Plus} onClick={() => setModal({ mode: "create" })}>
            Nueva cancha
          </ActionButton>
        )}
      </div>

      {/* Error de carga */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Skeleton de carga — altura fija previene CLS */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      )}

      {/* Filtros de deporte */}
      {!loading && courts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* "Todos" tiene estilo activo por defecto (primary + sombra) */}
          <button
            onClick={() => setFilterSport(null)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              filterSport === null
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
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
                onClick={() => setFilterSport(isActive ? null : sport)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? `${badgeCls} shadow-sm ring-1 ring-inset ring-current`
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid de canchas */}
      {!loading && courts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.filter((c) => filterSport === null || c.sport === filterSport).map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              isOwner={isOwner}
              onEdit={(c) => setModal({ mode: "edit", court: c })}
              onDeleteRequest={setDeleteTarget}
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

      {/* Modal de creación / edición */}
      {modal && (
        <CourtFormModal
          modal={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* AlertDialog de confirmación de borrado */}
      {deleteTarget && (
        <DeleteConfirmDialog
          court={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Toast state={toast} />
    </div>
  );
}
