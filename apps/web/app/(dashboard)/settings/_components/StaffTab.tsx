"use client";
// apps/web/app/(dashboard)/settings/_components/StaffTab.tsx
//
// Pestaña "Equipo" en la pantalla de Ajustes.
// Permite al OWNER invitar usuarios registrados en ClubSync y ver el listado
// de miembros del equipo con su estado (Pendiente / Activo) y roles (Badges).

import { useState } from "react";
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";

import { useClubSession }  from "@/contexts/ClubSessionContext";
import { useStaffTab }     from "../_hooks/useStaffTab";
import { cn }              from "@/lib/utils";
import type { StaffMemberOut } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Roles que puede asignar un OWNER vía invitación (OWNER requiere acceso directo a DB) */
const INVITABLE_ROLES: { value: string; label: string; description: string }[] = [
  {
    value:       "RESERVATIONS_MANAGER",
    label:       "Gestor de Reservas",
    description: "Gestiona reservas y socios del club",
  },
  {
    value:       "STOCK_MANAGER",
    label:       "Gestor de Stock",
    description: "Gestiona el inventario y los gastos",
  },
];

/** Etiquetas y estilos visuales por rol */
const ROLE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  OWNER: {
    label:     "Propietario",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  RESERVATIONS_MANAGER: {
    label:     "Reservas",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  STOCK_MANAGER: {
    label:     "Stock",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

// ── Sub-component: RoleBadge ──────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? {
    label:     role,
    className: "border-gray-200 bg-gray-50 text-gray-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── Sub-component: StaffRow ───────────────────────────────────────────────────

function StaffRow({ member }: { member: StaffMemberOut }) {
  const displayName =
    [member.user_first_name, member.user_last_name].filter(Boolean).join(" ") || "—";
  const isActive = member.status === "ACTIVE";

  return (
    <li className="flex items-center justify-between px-6 py-4">
      {/* Avatar + identidad */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground uppercase"
        >
          {member.email[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      {/* Roles (Badges) + badge de estado */}
      <div className="ml-4 flex shrink-0 flex-wrap items-center gap-2">
        {/* Badges de roles — uno por rol */}
        <div className="hidden sm:flex items-center gap-1.5">
          {member.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>

        {/* Badge de estado (Activo / Pendiente) */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200  bg-amber-50  text-amber-700",
          )}
        >
          {isActive ? (
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Clock className="h-3 w-3" aria-hidden="true" />
          )}
          {isActive ? "Activo" : "Pendiente"}
        </span>
      </div>
    </li>
  );
}

// ── Sub-component: RoleCheckbox ───────────────────────────────────────────────

function RoleCheckbox({
  role,
  checked,
  onChange,
}: {
  role: (typeof INVITABLE_ROLES)[number];
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked
          ? "border-foreground/30 bg-muted/60"
          : "border-border bg-background hover:bg-muted/30",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-foreground cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(role.value, e.target.checked)}
      />
      <div>
        <p className="text-sm font-medium text-foreground leading-none">{role.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
      </div>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StaffTab() {
  const { activeClub } = useClubSession();
  const clubId = activeClub?.clubId;

  const { staff, isLoadingStaff, invite, isInviting, inviteError, inviteSuccess } =
    useStaffTab(clubId);

  // ── Form local state ──────────────────────────────────────────────────────────
  const [email,         setEmail]         = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["RESERVATIONS_MANAGER"]);

  const toggleRole = (value: string, checked: boolean) => {
    setSelectedRoles((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || selectedRoles.length === 0) return;
    await invite({ email: email.trim(), roles: selectedRoles });
    // Limpiar formulario solo si no hubo error
    if (!inviteError) {
      setEmail("");
      setSelectedRoles(["RESERVATIONS_MANAGER"]);
    }
  };

  const canSubmit = email.trim().length > 0 && selectedRoles.length > 0 && !isInviting;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Card: Formulario de invitación ── */}
      <section
        aria-labelledby="invite-heading"
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div>
          <h2 id="invite-heading" className="text-sm font-semibold text-foreground">
            Invitar miembro al equipo
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            El usuario debe estar registrado previamente en ClubSync.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground transition-colors",
                "focus:outline-none focus:ring-1",
                inviteError
                  ? "border-destructive focus:border-destructive focus:ring-destructive/30"
                  : "border-border focus:border-foreground focus:ring-foreground/10",
              )}
            />
          </div>

          {/* Roles — checkboxes para permitir selección múltiple */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-foreground">
              Roles{" "}
              <span className="font-normal text-muted-foreground">
                (podés asignar más de uno)
              </span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INVITABLE_ROLES.map((role) => (
                <RoleCheckbox
                  key={role.value}
                  role={role}
                  checked={selectedRoles.includes(role.value)}
                  onChange={toggleRole}
                />
              ))}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-xs text-destructive">
                Seleccioná al menos un rol.
              </p>
            )}
          </fieldset>

          {/* Botón de envío */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-foreground text-background hover:bg-foreground/80",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isInviting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Invitar
            </button>

            {/* Feedback inline */}
            {inviteError && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Invitación enviada correctamente.
              </p>
            )}
          </div>
        </form>
      </section>

      {/* ── Card: Listado de equipo ── */}
      <section
        aria-labelledby="staff-list-heading"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="staff-list-heading"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Miembros del equipo
          </h2>
          <span className="text-xs text-muted-foreground">
            {staff.length} {staff.length === 1 ? "miembro" : "miembros"}
          </span>
        </div>

        {isLoadingStaff ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-label="Cargando equipo…"
            />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" aria-hidden="true" />
            <p className="text-sm">Todavía no hay miembros en el equipo.</p>
          </div>
        ) : (
          <ul aria-label="Lista de miembros del equipo" className="divide-y divide-border">
            {staff.map((member) => (
              <StaffRow key={member.id} member={member} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
