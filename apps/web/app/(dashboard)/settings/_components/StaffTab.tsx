"use client";
// apps/web/app/(dashboard)/settings/_components/StaffTab.tsx
//
// Pestaña "Equipo" en la pantalla de Ajustes.
// Permite al OWNER invitar usuarios registrados en ClubSync, ver el listado
// de miembros con sus roles (Badges) y editar los roles de cada miembro.

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { useClubSession }  from "@/contexts/ClubSessionContext";
import { useStaffTab }     from "../_hooks/useStaffTab";
import { cn }              from "@/lib/utils";
import type { StaffMemberOut } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
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
          ? "border-gray-300 bg-gray-50"
          : "border-gray-100 bg-white hover:bg-gray-50",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(role.value, e.target.checked)}
      />
      <div>
        <p className="text-sm font-medium text-gray-900 leading-none">{role.label}</p>
        <p className="mt-1 text-xs text-gray-400">{role.description}</p>
      </div>
    </label>
  );
}

// ── Sub-component: EditRolesModal ─────────────────────────────────────────────

interface EditRolesModalProps {
  member:         StaffMemberOut;
  isUpdating:     boolean;
  error:          string | null;
  onSave:         (roles: string[]) => void;
  onClose:        () => void;
}

function EditRolesModal({ member, isUpdating, error, onSave, onClose }: EditRolesModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const initialRoles = member.roles.filter((r) =>
    INVITABLE_ROLES.some((ir) => ir.value === r),
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);

  const toggleRole = (value: string, checked: boolean) => {
    setSelectedRoles((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value),
    );
  };

  const displayName =
    [member.user_first_name, member.user_last_name].filter(Boolean).join(" ") ||
    member.email;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-sm rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Editar roles</h2>
            <p className="mt-0.5 truncate text-xs text-gray-400">{displayName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-gray-700">
              Roles asignados
            </legend>
            {INVITABLE_ROLES.map((role) => (
              <RoleCheckbox
                key={role.value}
                role={role}
                checked={selectedRoles.includes(role.value)}
                onChange={toggleRole}
              />
            ))}
            {selectedRoles.length === 0 && (
              <p className="text-xs text-red-600">Seleccioná al menos un rol.</p>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onSave(selectedRoles)}
              disabled={isUpdating || selectedRoles.length === 0}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar cambios"
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: StaffRow ───────────────────────────────────────────────────

interface StaffRowProps {
  member:    StaffMemberOut;
  onEdit:    (member: StaffMemberOut) => void;
}

function StaffRow({ member, onEdit }: StaffRowProps) {
  const displayName =
    [member.user_first_name, member.user_last_name].filter(Boolean).join(" ") || "—";
  const isActive  = member.status === "ACTIVE";
  const isOwner   = member.roles.includes("OWNER");

  return (
    <li className="flex items-center justify-between px-6 py-4">
      {/* Avatar + identidad */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 uppercase"
        >
          {member.email[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
          <p className="truncate text-xs text-gray-400">{member.email}</p>
        </div>
      </div>

      {/* Roles + estado + editar */}
      <div className="ml-4 flex shrink-0 flex-wrap items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5">
          {member.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>

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

        {/* Botón editar — oculto para OWNER (no editable vía UI) */}
        {!isOwner && (
          <button
            onClick={() => onEdit(member)}
            title="Editar roles"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:border-gray-300 hover:text-gray-700 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StaffTab() {
  const { activeClub } = useClubSession();
  const clubId = activeClub?.clubId;

  const {
    staff, isLoadingStaff,
    invite, isInviting, inviteError, inviteSuccess,
    updateRoles, isUpdatingRoles, updateError, updateSuccess,
  } = useStaffTab(clubId);

  // ── Invite form ───────────────────────────────────────────────────────────────
  const [email,         setEmail]         = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["RESERVATIONS_MANAGER"]);

  const toggleRole = (value: string, checked: boolean) => {
    setSelectedRoles((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value),
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || selectedRoles.length === 0) return;
    await invite({ email: email.trim(), roles: selectedRoles });
    if (!inviteError) {
      setEmail("");
      setSelectedRoles(["RESERVATIONS_MANAGER"]);
    }
  };

  const canSubmit = email.trim().length > 0 && selectedRoles.length > 0 && !isInviting;

  // ── Edit roles modal ──────────────────────────────────────────────────────────
  const [editingMember, setEditingMember] = useState<StaffMemberOut | null>(null);

  const handleSaveRoles = async (roles: string[]) => {
    if (!editingMember) return;
    await updateRoles(editingMember.id, { roles });
    if (!updateError) setEditingMember(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Card: Formulario de invitación ── */}
      <section
        aria-labelledby="invite-heading"
        className="rounded-xl border border-gray-100 bg-white p-6 space-y-5"
      >
        <div>
          <h2 id="invite-heading" className="text-sm font-semibold text-gray-900">
            Invitar miembro al equipo
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            El usuario debe estar registrado previamente en ClubSync.
          </p>
        </div>

        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-xs font-medium text-gray-700">
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
                "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900",
                "placeholder:text-gray-300 transition-colors",
                "focus:outline-none focus:ring-1",
                inviteError
                  ? "border-red-300 focus:border-red-400 focus:ring-red-300/30"
                  : "border-gray-200 focus:border-gray-400 focus:ring-gray-400/10",
              )}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-gray-700">
              Roles{" "}
              <span className="font-normal text-gray-400">(podés asignar más de uno)</span>
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
              <p className="text-xs text-red-600">Seleccioná al menos un rol.</p>
            )}
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              {isInviting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Invitar
            </button>

            {inviteError && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Invitación enviada correctamente.
              </p>
            )}
          </div>
        </form>
      </section>

      {/* ── Card: Listado de equipo ── */}
      <section
        aria-labelledby="staff-list-heading"
        className="overflow-hidden rounded-xl border border-gray-100 bg-white"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2
            id="staff-list-heading"
            className="flex items-center gap-2 text-sm font-semibold text-gray-900"
          >
            <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Miembros del equipo
          </h2>
          <div className="flex items-center gap-3">
            {updateSuccess && (
              <p role="status" className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Roles actualizados.
              </p>
            )}
            <span className="text-xs text-gray-400">
              {staff.length} {staff.length === 1 ? "miembro" : "miembros"}
            </span>
          </div>
        </div>

        {isLoadingStaff ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-5 w-5 animate-spin text-gray-300"
              aria-label="Cargando equipo…"
            />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
            <Users className="h-8 w-8 opacity-30" aria-hidden="true" />
            <p className="text-sm">Todavía no hay miembros en el equipo.</p>
          </div>
        ) : (
          <ul aria-label="Lista de miembros del equipo" className="divide-y divide-gray-50">
            {staff.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                onEdit={setEditingMember}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Modal de edición de roles ── */}
      {editingMember && (
        <EditRolesModal
          member={editingMember}
          isUpdating={isUpdatingRoles}
          error={updateError}
          onSave={handleSaveRoles}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
