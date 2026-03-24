"use client";
// apps/web/app/(dashboard)/members/page.tsx
// Módulo de Socios: tabla, búsqueda, CRUD (crear / editar / desactivar), export CSV.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, UserCheck, TrendingDown, UserPlus, Search,
  Download, Pencil, Trash2, X, XCircle, AlertTriangle,
  ChevronDown, Sparkles, Copy, Check, MessageCircle,
} from "lucide-react";

import {
  membersApi,
  type MemberOut,
  type MemberCreate,
  type MemberUpdate,
} from "@/lib/api";
import { useClubSession } from "@/contexts/ClubSessionContext";
import { PageHeader }     from "@/components/ui/page-header";

// ── Health Score ─────────────────────────────────────────────────────────────

type HealthScore = "active" | "at_risk" | "inactive";

function deriveHealthScore(m: MemberOut): HealthScore {
  if (!m.is_active) return "inactive";
  if (!m.last_login_at) return "active";
  const days = Math.floor(
    (Date.now() - new Date(m.last_login_at).getTime()) / 86_400_000,
  );
  return days >= 30 ? "at_risk" : "active";
}

function deriveActivityDays(m: MemberOut): number | null {
  if (!m.last_login_at) return null;
  return Math.floor(
    (Date.now() - new Date(m.last_login_at).getTime()) / 86_400_000,
  );
}

const HEALTH_CFG: Record<
  HealthScore,
  { label: string; bg: string; border: string; text: string; dot: string; pulse: boolean }
> = {
  active:   { label: "Activo",    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", pulse: false },
  at_risk:  { label: "En riesgo", bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400",  pulse: true  },
  inactive: { label: "Inactivo",  bg: "bg-red-50",     border: "border-red-200",     text: "text-red-600",     dot: "bg-red-500",    pulse: false },
};

// ── Constants ────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "male",   label: "Masculino" },
  { value: "female", label: "Femenino"  },
  { value: "other",  label: "Otro"      },
];

const PLAN_SUGGESTIONS = [
  "Mensual", "Trimestral", "Semestral", "Anual",
  "Familiar", "Junior", "Senior", "Corporativo",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatJoinedAt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR", { year: "numeric", month: "short" });
}

// ── WhatsApp message generator ───────────────────────────────────────────────

function generateWhatsAppMessage(m: MemberOut, hs: HealthScore): string {
  const club = "el club";
  const days = deriveActivityDays(m);
  if (hs === "at_risk") {
    return (
      `¡Hola ${m.first_name}! 👋 Te escribimos desde ${club}.\n\n` +
      `Notamos que hace ${days ?? "un tiempo"} días no accediste al sistema, ` +
      `y queremos que sepas que te extrañamos 🎾\n\n` +
      `Queremos darte un *20% de descuento en tu próxima reserva* para que vuelvas a disfrutar del club.\n\n` +
      `¡Tu lugar siempre está reservado! 💚\n\n¿Te gustaría reservar tu turno?`
    );
  }
  if (hs === "inactive") {
    return (
      `¡Hola ${m.first_name}! 👋 Somos ${club}.\n\n` +
      `Hace un tiempo que no sabemos de vos. Como socio${m.member_number ? ` N° ${m.member_number}` : ""}, ` +
      `valoramos mucho tu trayectoria 🏆\n\n` +
      `Queremos invitarte a volver con una *semana gratuita de actividades* ` +
      `y un *50% off en la cuota del mes que volvés*.\n\n` +
      `¡El grupo pregunta por vos! 💚\n\n¿Te animás a volver?`
    );
  }
  return (
    `¡Hola ${m.first_name}! 👋 Gracias por ser parte de ${club}.\n\n` +
    `Como uno de nuestros socios más activos, queremos premiarte con *acceso prioritario* ` +
    `a las nuevas instalaciones 🎉\n\n` +
    `Además podés invitar a un amigo a probar el club *gratis por 2 semanas*.\n\n` +
    `¡Seguís siendo parte de lo mejor del club! 💚`
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function MemberAvatar({ member, hs }: { member: MemberOut; hs: HealthScore }) {
  const cfg = HEALTH_CFG[hs];
  return (
    <div className="relative flex-shrink-0">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
        member.is_active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
      }`}>
        {initials(member.first_name, member.last_name)}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
    </div>
  );
}

// ── AI Modal ──────────────────────────────────────────────────────────────────

function AIModal({
  member,
  hs,
  onClose,
}: {
  member:  MemberOut;
  hs:      HealthScore;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const cfg     = HEALTH_CFG[hs];
  const message = generateWhatsAppMessage(member, hs);
  const days    = deriveActivityDays(member);

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function handleWhatsApp() {
    const phone = (member.phone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Acción IA · {member.first_name} {member.last_name}</p>
              <p className="text-xs text-gray-400">{member.member_number ?? member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Health badge */}
        <div className="px-6 pt-4">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label} ·{" "}
            {days === null ? "Sin actividad registrada"
              : days === 0 ? "Activo hoy"
              : days === 1 ? "Visto ayer"
              : `Hace ${days} días sin actividad`}
          </div>
        </div>
        {/* Message preview */}
        <div className="px-6 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Mensaje generado</p>
          <div className="rounded-xl bg-[#DCF8C6] p-4 relative">
            <div className="absolute top-3 right-3 text-[10px] text-gray-400 font-medium">WhatsApp</div>
            <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed pr-16">{message}</p>
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "¡Copiado!" : "Copiar mensaje"}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Form Modal (Create / Edit) ─────────────────────────────────────────

interface MemberFormModalProps {
  mode:     "create" | "edit";
  initial:  Partial<MemberOut>;
  saving:   boolean;
  error:    string | null;
  onClose:  () => void;
  onSubmit: (data: MemberCreate | MemberUpdate) => void;
}

function MemberFormModal({ mode, initial, saving, error, onClose, onSubmit }: MemberFormModalProps) {
  const [form, setForm] = useState({
    first_name:      initial.first_name      ?? "",
    last_name:       initial.last_name       ?? "",
    email:           initial.email           ?? "",
    phone:           initial.phone           ?? "",
    dni:             initial.dni             ?? "",
    member_number:   initial.member_number   ?? "",
    birth_date:      initial.birth_date      ?? "",
    joined_at:       initial.joined_at       ?? "",
    gender:          initial.gender          ?? "",
    membership_plan: initial.membership_plan ?? "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit() {
    const clean = (v: string) => v.trim() || null;
    const payload: Record<string, unknown> = {
      first_name:      form.first_name.trim(),
      last_name:       form.last_name.trim(),
      phone:           clean(form.phone),
      dni:             clean(form.dni),
      member_number:   clean(form.member_number),
      birth_date:      clean(form.birth_date),
      joined_at:       clean(form.joined_at),
      gender:          clean(form.gender),
      membership_plan: clean(form.membership_plan),
    };
    if (mode === "create") payload.email = form.email.trim();
    onSubmit(payload as MemberCreate | MemberUpdate);
  }

  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400";
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
              <UserPlus className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {mode === "create" ? "Nuevo socio" : "Editar socio"}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition cursor-pointer disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-4">

          {/* Nombre / Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={form.first_name} onChange={set("first_name")} disabled={saving} placeholder="Juan" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellido *</label>
              <input value={form.last_name} onChange={set("last_name")} disabled={saving} placeholder="García" className={inputCls} />
            </div>
          </div>

          {/* Email (solo creación) */}
          {mode === "create" && (
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" value={form.email} onChange={set("email")} disabled={saving} placeholder="juan@ejemplo.com" className={inputCls} />
            </div>
          )}

          {/* Teléfono / DNI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.phone} onChange={set("phone")} disabled={saving} placeholder="+54 9 11 1234-5678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DNI</label>
              <input value={form.dni} onChange={set("dni")} disabled={saving} placeholder="30.123.456" className={inputCls} />
            </div>
          </div>

          {/* N° Socio / Género */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>N° Socio</label>
              <input value={form.member_number} onChange={set("member_number")} disabled={saving} placeholder="001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Género</label>
              <select
                value={form.gender}
                onChange={set("gender")}
                disabled={saving}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">Sin especificar</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className={labelCls}>Plan de membresía</label>
            <input
              list="plan-suggestions"
              value={form.membership_plan}
              onChange={set("membership_plan")}
              disabled={saving}
              placeholder="Ej: Mensual, Anual…"
              className={inputCls}
            />
            <datalist id="plan-suggestions">
              {PLAN_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de ingreso</label>
              <input type="date" value={form.joined_at} onChange={set("joined_at")} disabled={saving} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de nacimiento</label>
              <input type="date" value={form.birth_date} onChange={set("birth_date")} disabled={saving} className={inputCls} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim() || (mode === "create" && !form.email.trim())}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {saving ? "Guardando…" : mode === "create" ? "Crear socio" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "active" | "at_risk" | "inactive";

export default function MembersPage() {
  const { activeClub, isLoading: sessionLoading } = useClubSession();

  // ── Data ────────────────────────────────────────────────────
  const [members, setMembers]       = useState<MemberOut[]>([]);
  const [loading, setLoading]       = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Filters ─────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  // ── Modal targets ────────────────────────────────────────────
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<MemberOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberOut | null>(null);
  const [aiTarget, setAiTarget]         = useState<MemberOut | null>(null);

  // ── Mutation state ────────────────────────────────────────────
  const [saving, setSaving]     = useState(false);
  const [mutError, setMutError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  // ── Export dropdown ───────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await membersApi.list({ pageSize: 200 });
      setMembers(res.items);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Error al cargar socios.");
    } finally {
      setLoading(false);
    }
  }, [activeClub]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Derived ───────────────────────────────────────────────────
  const membersWithHealth = members.map((m) => ({ m, hs: deriveHealthScore(m) }));

  const stats = {
    total:    membersWithHealth.length,
    active:   membersWithHealth.filter((x) => x.hs === "active").length,
    at_risk:  membersWithHealth.filter((x) => x.hs === "at_risk").length,
    inactive: membersWithHealth.filter((x) => x.hs === "inactive").length,
  };

  const filtered = membersWithHealth.filter(({ m, hs }) => {
    if (filter !== "all" && hs !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.member_number ?? "").toLowerCase().includes(q) ||
        (m.dni ?? "").toLowerCase().includes(q) ||
        (m.membership_plan ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── CRUD handlers ─────────────────────────────────────────────

  async function handleCreate(data: MemberCreate | MemberUpdate) {
    setSaving(true);
    setMutError(null);
    try {
      const created = await membersApi.create(data as MemberCreate);
      setMembers((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err: unknown) {
      setMutError(err instanceof Error ? err.message : "Error al crear socio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: MemberCreate | MemberUpdate) {
    if (!editTarget) return;
    setSaving(true);
    setMutError(null);
    try {
      const updated = await membersApi.update(editTarget.id, data as MemberUpdate);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditTarget(null);
    } catch (err: unknown) {
      setMutError(err instanceof Error ? err.message : "Error al guardar cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDelError(null);
    try {
      await membersApi.remove(deleteTarget.id);
      setMembers((prev) =>
        prev.map((m) => (m.id === deleteTarget.id ? { ...m, is_active: false } : m)),
      );
      setDeleteTarget(null);
    } catch (err: unknown) {
      setDelError(err instanceof Error ? err.message : "Error al desactivar socio.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(isActive?: boolean) {
    setExporting(true);
    setExportOpen(false);
    try {
      await membersApi.exportCsv(isActive !== undefined ? { isActive } : undefined);
    } catch (err: unknown) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }

  // ── No club guard ──────────────────────────────────────────────

  if (!sessionLoading && !activeClub) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="rounded-full bg-gray-100 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">Sin club activo</p>
        <p className="mt-1 text-xs text-gray-400">Seleccioná un club para ver sus socios.</p>
      </div>
    );
  }

  const isPageLoading = sessionLoading || loading;

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <PageHeader
        title="Socios"
        subtitle={isPageLoading ? "Cargando…" : `${stats.total} socios registrados`}
      >
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting || isPageLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exportando…" : "Exportar"}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-100 bg-white shadow-lg z-20 overflow-hidden">
                {[
                  { label: "Todos los socios", fn: () => handleExport(undefined) },
                  { label: "Solo activos",      fn: () => handleExport(true)      },
                  { label: "Solo inactivos",    fn: () => handleExport(false)     },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New member */}
          <button
            onClick={() => { setMutError(null); setCreateOpen(true); }}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            <UserPlus className="h-4 w-4" />
            Nuevo socio
          </button>
        </div>
      </PageHeader>

      {/* ── Stats cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total de socios</p>
            <div className="rounded-lg bg-gray-50 p-2"><Users className="h-4 w-4 text-gray-400" /></div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{isPageLoading ? "—" : stats.total}</p>
          <p className="mt-1 text-xs text-gray-400">registrados en el club</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Socios activos</p>
            <div className="rounded-lg bg-emerald-50 p-2"><UserCheck className="h-4 w-4 text-emerald-600" /></div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{isPageLoading ? "—" : stats.active}</p>
          <p className="mt-1 text-xs text-gray-400">
            {!isPageLoading && stats.total > 0 && (
              <><span className="font-medium text-gray-600">{Math.round((stats.active / stats.total) * 100)}%</span> del total</>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">En riesgo · IA</p>
            <div className="rounded-lg bg-amber-100 p-2"><TrendingDown className="h-4 w-4 text-amber-600" /></div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-700">{isPageLoading ? "—" : stats.at_risk + stats.inactive}</p>
          <p className="mt-1 text-xs text-amber-600">
            {!isPageLoading && `${stats.at_risk} en riesgo · ${stats.inactive} inactivos`}
          </p>
        </div>
      </div>

      {/* ── Filters + Search ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {([
            { key: "all",      label: "Todos",     count: stats.total    },
            { key: "active",   label: "Activos",   count: stats.active   },
            { key: "at_risk",  label: "En riesgo", count: stats.at_risk  },
            { key: "inactive", label: "Inactivos", count: stats.inactive },
          ] as { key: FilterKey; label: string; count: number }[]).map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => { if (key !== filter) setFilter(key); }}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  isActive ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                style={isActive ? { backgroundColor: "var(--color-brand)" } : {}}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, N° socio, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-lg border border-gray-200 py-2.5 pl-10 pr-8 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">

        {fetchError && (
          <div className="px-6 py-8 text-center text-sm text-red-500">{fetchError}</div>
        )}

        {isPageLoading && !fetchError && (
          <div className="px-6 py-16 text-center text-sm text-gray-400">Cargando socios…</div>
        )}

        {!isPageLoading && !fetchError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <Users className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              {search ? "Sin resultados para esa búsqueda." : "No hay socios en este filtro."}
            </p>
          </div>
        )}

        {!isPageLoading && !fetchError && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {["Socio", "N° Socio", "DNI", "Teléfono", "Plan", "Ingresó", "Estado", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`px-5 py-3.5 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                      i === 7 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(({ m, hs }) => {
                const cfg  = HEALTH_CFG[hs];
                const days = deriveActivityDays(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">

                    {/* Socio */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <MemberAvatar member={m} hs={hs} />
                        <div>
                          <p className="font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-gray-400">{m.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* N° Socio */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm text-gray-700">{m.member_number ?? "—"}</span>
                    </td>

                    {/* DNI */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-600">{m.dni ?? "—"}</span>
                    </td>

                    {/* Teléfono */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-600">{m.phone ?? "—"}</span>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3.5">
                      {m.membership_plan ? (
                        <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {m.membership_plan}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </td>

                    {/* Ingresó */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-600">{formatJoinedAt(m.joined_at)}</span>
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium w-fit ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
                          {cfg.label}
                        </span>
                        {days !== null && (
                          <span className="text-[10px] text-gray-400 tabular-nums pl-0.5">
                            {days === 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days}d`}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAiTarget(m)}
                          title="Generar acción IA"
                          className="rounded-lg p-1.5 text-violet-400 hover:bg-violet-50 hover:text-violet-600 transition cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setMutError(null); setEditTarget(m); }}
                          title="Editar socio"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {m.is_active && (
                          <button
                            onClick={() => { setDelError(null); setDeleteTarget(m); }}
                            title="Desactivar socio"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isPageLoading && filtered.length > 0 && (
          <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Mostrando {filtered.length} de {stats.total} socios
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Sparkles className="h-3 w-3 text-violet-400" />
              <span>Health Score calculado por IA</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ──────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">¿Desactivar este socio?</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deleteTarget.first_name} {deleteTarget.last_name}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                El socio quedará inactivo pero sus reservas y datos se conservan. Podés reactivarlo editando su perfil.
              </p>
              {delError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 mb-4">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{delError}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Desactivando…" : "Sí, desactivar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ───────────────────────────────────────── */}
      {createOpen && (
        <MemberFormModal
          mode="create"
          initial={{}}
          saving={saving}
          error={mutError}
          onClose={() => { setCreateOpen(false); setMutError(null); }}
          onSubmit={handleCreate}
        />
      )}

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      {editTarget && (
        <MemberFormModal
          mode="edit"
          initial={editTarget}
          saving={saving}
          error={mutError}
          onClose={() => { setEditTarget(null); setMutError(null); }}
          onSubmit={handleUpdate}
        />
      )}

      {/* ── AI Modal ───────────────────────────────────────────── */}
      {aiTarget && (
        <AIModal
          member={aiTarget}
          hs={deriveHealthScore(aiTarget)}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  );
}
