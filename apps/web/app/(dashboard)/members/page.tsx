"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, AlertTriangle, Sparkles, Copy, Check,
  MessageCircle, X, Search, UserPlus, TrendingDown,
} from "lucide-react";
import { membersApi, type MemberOut } from "@/lib/api";

// ── Health Score derivation ────────────────────────────────────

type HealthScore = "active" | "at_risk" | "inactive";

function deriveHealthScore(m: MemberOut): HealthScore {
  if (!m.is_active) return "inactive";
  if (!m.last_login_at) return "active"; // new member, never logged in
  const daysSince = Math.floor(
    (Date.now() - new Date(m.last_login_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince >= 30) return "at_risk";
  return "active";
}

function deriveLastActivityDays(m: MemberOut): number | null {
  if (!m.last_login_at) return null;
  return Math.floor(
    (Date.now() - new Date(m.last_login_at).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ── Config ────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<HealthScore, { label: string; bg: string; border: string; text: string; dot: string; pulse: boolean }> = {
  active:   { label: "Activo",    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", pulse: false },
  at_risk:  { label: "En riesgo", bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400",  pulse: true  },
  inactive: { label: "Inactivo",  bg: "bg-red-50",     border: "border-red-200",     text: "text-red-600",     dot: "bg-red-500",    pulse: false },
};

type Filter = "all" | "active" | "at_risk" | "inactive";

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatJoinedAt(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", { year: "numeric", month: "short" });
}

// ── AI Message Generator ──────────────────────────────────────

function generateWhatsAppMessage(m: MemberOut, healthScore: HealthScore): string {
  const club = "Los Cardos Rugby Club";
  const firstName = m.first_name;
  const activityDays = deriveLastActivityDays(m);

  if (healthScore === "at_risk") {
    return (
      `¡Hola ${firstName}! 👋 Te escribimos desde ${club}.\n\n` +
      `Notamos que hace ${activityDays ?? "un tiempo"} días no accediste al sistema, y queremos que sepas que te extrañamos 🎾\n\n` +
      `Queremos darte un *20% de descuento en tu próxima reserva* para que vuelvas a disfrutar del club.\n\n` +
      `¡Tu lugar siempre está reservado en Los Cardos! 💚\n\n¿Te gustaría reservar tu turno?`
    );
  }
  if (healthScore === "inactive") {
    return (
      `¡Hola ${firstName}! 👋 Somos ${club}.\n\n` +
      `Hace un tiempo que no sabemos de vos. Como socio N° ${m.member_number ?? ""}, valoramos mucho tu trayectoria en el club 🏆\n\n` +
      `Queremos invitarte a volver con una *semana gratuita de actividades* y un *50% off en la cuota del mes que volvés*.\n\n` +
      `¡El grupo pregunta por vos! 💚\n\n¿Te animás a volver?`
    );
  }
  return (
    `¡Hola ${firstName}! 👋 Gracias por ser parte de ${club}.\n\n` +
    `Como uno de nuestros socios más activos, queremos premiarte con *acceso prioritario* a las nuevas instalaciones 🎉\n\n` +
    `Además podés invitar a un amigo a probar el club *gratis por 2 semanas*.\n\n` +
    `¡Seguís siendo parte de lo mejor de Los Cardos! 💚`
  );
}

// ── Avatar ────────────────────────────────────────────────────

function Avatar({ member, healthScore }: { member: MemberOut; healthScore: HealthScore }) {
  const cfg = HEALTH_CONFIG[healthScore];
  return (
    <div className="relative flex-shrink-0">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
        member.is_active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
      }`}>
        {getInitials(member.first_name, member.last_name)}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
    </div>
  );
}

// ── AI Modal ──────────────────────────────────────────────────

function AIModal({
  member,
  healthScore,
  onClose,
}: {
  member: MemberOut;
  healthScore: HealthScore;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const message = generateWhatsAppMessage(member, healthScore);
  const cfg = HEALTH_CONFIG[healthScore];
  const activityDays = deriveLastActivityDays(member);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Acción IA · {member.first_name} {member.last_name}
              </p>
              <p className="text-xs text-gray-400">{member.member_number ?? member.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Health badge */}
        <div className="px-6 pt-4">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label} ·{" "}
            {activityDays === null
              ? "Sin actividad registrada"
              : activityDays === 0
              ? "Activo hoy"
              : activityDays === 1
              ? "Visto ayer"
              : `Hace ${activityDays} días sin actividad`}
          </div>
        </div>

        {/* WhatsApp preview */}
        <div className="px-6 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Mensaje generado</p>
          <div className="rounded-xl bg-[#DCF8C6] p-4 relative">
            <div className="absolute top-3 right-3 text-[10px] text-gray-400 font-medium">WhatsApp</div>
            <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed pr-16">
              {message}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-6 py-4">
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

// ── Page ──────────────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiTarget, setAiTarget] = useState<MemberOut | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
      return;
    }
    membersApi.list({ pageSize: 200 })
      .then((res) => setMembers(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  // Compute health scores for all members
  const membersWithHealth = members.map((m) => ({
    member: m,
    healthScore: deriveHealthScore(m),
  }));

  const stats = {
    total:    membersWithHealth.length,
    active:   membersWithHealth.filter((m) => m.healthScore === "active").length,
    at_risk:  membersWithHealth.filter((m) => m.healthScore === "at_risk").length,
    inactive: membersWithHealth.filter((m) => m.healthScore === "inactive").length,
  };

  const filtered = membersWithHealth.filter(({ member, healthScore }) => {
    if (filter !== "all" && healthScore !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        `${member.first_name} ${member.last_name}`.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.member_number ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Socios</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {loading ? "Cargando…" : `${stats.total} socios registrados`}
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <UserPlus className="h-4 w-4" />
          Nuevo socio
        </button>
      </div>

      {/* ── Metric Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total de socios</p>
            <div className="rounded-lg bg-gray-50 p-2">
              <Users className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{loading ? "—" : stats.total}</p>
          <p className="mt-1 text-xs text-gray-400">registrados en el club</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Socios activos</p>
            <div className="rounded-lg bg-emerald-50 p-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{loading ? "—" : stats.active}</p>
          <p className="mt-1 text-xs text-gray-400">
            {loading ? "" : (
              <span>
                <span className="font-medium text-gray-600">
                  {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                </span>{" "}
                del total
              </span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">En riesgo de fuga · IA</p>
            <div className="rounded-lg bg-amber-100 p-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-700">{loading ? "—" : stats.at_risk + stats.inactive}</p>
          <p className="mt-1 text-xs text-amber-600">
            {loading ? "" : `${stats.at_risk} en riesgo · ${stats.inactive} inactivos`}
          </p>
        </div>
      </div>

      {/* ── Filters + Search ────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {([
            { key: "all",      label: "Todos",     count: stats.total    },
            { key: "active",   label: "Activos",   count: stats.active   },
            { key: "at_risk",  label: "En riesgo", count: stats.at_risk  },
            { key: "inactive", label: "Inactivos", count: stats.inactive },
          ] as { key: Filter; label: string; count: number }[]).map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
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
            placeholder="Buscar socio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition"
          />
        </div>
      </div>

      {/* ── Smart Table ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {["Socio", "Health Score", "N° Socio", "Miembro desde", "Último acceso", "Acción IA"].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                    i >= 2 ? "text-right" : "text-left"
                  } ${i === 5 ? "text-center" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                  Cargando socios…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtered.map(({ member, healthScore }) => {
                const cfg = HEALTH_CONFIG[healthScore];
                const activityDays = deriveLastActivityDays(member);
                return (
                  <tr key={member.id} className="hover:bg-gray-50/60 transition-colors">

                    {/* Socio */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar member={member} healthScore={healthScore} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-gray-400">{member.phone ?? member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Health Score */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
                        {cfg.label}
                      </span>
                    </td>

                    {/* N° Socio */}
                    <td className="px-6 py-4 text-right">
                      <p className="font-mono text-sm text-gray-700">{member.member_number ?? "—"}</p>
                    </td>

                    {/* Miembro desde */}
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-700">{formatJoinedAt(member.joined_at)}</p>
                    </td>

                    {/* Último acceso */}
                    <td className="px-6 py-4 text-right">
                      {activityDays === null ? (
                        <p className="text-sm text-gray-300">—</p>
                      ) : (
                        <p className={`text-sm tabular-nums ${
                          activityDays <= 7 ? "text-emerald-600" :
                          activityDays <= 29 ? "text-amber-600" : "text-red-500"
                        }`}>
                          {activityDays === 0 ? "Hoy"
                            : activityDays === 1 ? "Ayer"
                            : `Hace ${activityDays}d`}
                        </p>
                      )}
                    </td>

                    {/* Acción IA */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setAiTarget(member)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Generar acción
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="border-t border-gray-50 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Mostrando {filtered.length} de {stats.total} socios
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span>Health Score calculado por IA</span>
          </div>
        </div>
      </div>

      {/* ── AI Modal ────────────────────────────────────────── */}
      {aiTarget && (
        <AIModal
          member={aiTarget}
          healthScore={deriveHealthScore(aiTarget)}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  );
}
