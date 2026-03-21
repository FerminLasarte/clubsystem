// apps/web/app/(dashboard)/settings/_hooks/useStaffTab.ts
//
// Custom hook que encapsula toda la lógica de negocio de la pestaña Equipo:
//   - Carga del listado de staff vía GET /clubs/{clubId}/staff
//   - Envío de invitaciones vía POST /clubs/{clubId}/staff/invite
//   - Actualización de roles vía PUT /clubs/{clubId}/staff/{staffId}
//   - Gestión de estados: loading, error, success

import { useState, useEffect, useCallback } from "react";
import {
  staffApi,
  type StaffMemberOut,
  type InviteStaffPayload,
  type UpdateStaffRolesPayload,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UseStaffTabReturn {
  // Staff list
  staff:           StaffMemberOut[];
  isLoadingStaff:  boolean;
  // Invite
  invite:          (payload: InviteStaffPayload) => Promise<void>;
  isInviting:      boolean;
  inviteError:     string | null;
  inviteSuccess:   boolean;
  clearFeedback:   () => void;
  // Update roles
  updateRoles:     (staffId: string, payload: UpdateStaffRolesPayload) => Promise<void>;
  isUpdatingRoles: boolean;
  updateError:     string | null;
  updateSuccess:   boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStaffTab(clubId: string | undefined): UseStaffTabReturn {
  const [staff,           setStaff]           = useState<StaffMemberOut[]>([]);
  const [isLoadingStaff,  setIsLoadingStaff]  = useState(true);
  const [isInviting,      setIsInviting]      = useState(false);
  const [inviteError,     setInviteError]     = useState<string | null>(null);
  const [inviteSuccess,   setInviteSuccess]   = useState(false);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);
  const [updateError,     setUpdateError]     = useState<string | null>(null);
  const [updateSuccess,   setUpdateSuccess]   = useState(false);

  // ── Fetch staff list ─────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    if (!clubId) return;
    setIsLoadingStaff(true);
    try {
      const data = await staffApi.list(clubId);
      setStaff(data);
    } catch {
      // Si falla el listado, mostramos vacío — no bloqueamos la UI
      setStaff([]);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // ── Invite ───────────────────────────────────────────────────────────────────

  const invite = useCallback(
    async (payload: InviteStaffPayload) => {
      if (!clubId) return;

      setIsInviting(true);
      setInviteError(null);
      setInviteSuccess(false);

      try {
        const newMember = await staffApi.invite(clubId, payload);
        // Añadir el nuevo miembro al listado sin re-fetch
        setStaff((prev) => [...prev, newMember]);
        setInviteSuccess(true);
        // Auto-limpiar el feedback de éxito tras 3 s
        setTimeout(() => setInviteSuccess(false), 3000);
      } catch (err) {
        setInviteError(
          err instanceof Error
            ? err.message
            : "Error al enviar la invitación. Intentá de nuevo.",
        );
      } finally {
        setIsInviting(false);
      }
    },
    [clubId],
  );

  // ── Update roles ─────────────────────────────────────────────────────────────

  const updateRoles = useCallback(
    async (staffId: string, payload: UpdateStaffRolesPayload) => {
      if (!clubId) return;

      setIsUpdatingRoles(true);
      setUpdateError(null);
      setUpdateSuccess(false);

      try {
        const updated = await staffApi.updateRoles(clubId, staffId, payload);
        // Reemplazar el registro en la lista local sin re-fetch
        setStaff((prev) => prev.map((m) => (m.id === staffId ? updated : m)));
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } catch (err) {
        setUpdateError(
          err instanceof Error
            ? err.message
            : "Error al actualizar los roles. Intentá de nuevo.",
        );
      } finally {
        setIsUpdatingRoles(false);
      }
    },
    [clubId],
  );

  // ── Clear feedback ───────────────────────────────────────────────────────────

  const clearFeedback = useCallback(() => {
    setInviteError(null);
    setInviteSuccess(false);
    setUpdateError(null);
    setUpdateSuccess(false);
  }, []);

  return {
    staff,
    isLoadingStaff,
    invite,
    isInviting,
    inviteError,
    inviteSuccess,
    clearFeedback,
    updateRoles,
    isUpdatingRoles,
    updateError,
    updateSuccess,
  };
}
