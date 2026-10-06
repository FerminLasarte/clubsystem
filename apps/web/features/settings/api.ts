import { unwrap, type ClubUpdate, type InviteRequest, type ProfileUpdate, type StaffRole } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { sessionKey } from "@/features/auth/api";
import { api } from "@/lib/api";

const keys = {
  club: ["settings", "club"] as const,
  staff: ["settings", "staff"] as const,
  me: ["me"] as const,
};

export function useClubSettings() {
  return useQuery({ queryKey: keys.club, queryFn: () => unwrap(api.GET("/api/v1/admin/club")) });
}

export function useUpdateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClubUpdate) => unwrap(api.PATCH("/api/v1/admin/club", { body })),
    onSuccess: (club) => {
      queryClient.setQueryData(keys.club, club);
      // Nombre y colores del club también viven en la sesión.
      void queryClient.invalidateQueries({ queryKey: sessionKey });
      toast.success("Datos del club guardados");
    },
  });
}

export function useStaff() {
  return useQuery({ queryKey: keys.staff, queryFn: () => unwrap(api.GET("/api/v1/admin/staff")) });
}

export function useInviteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteRequest) => unwrap(api.POST("/api/v1/admin/staff/invitations", { body })),
    onSuccess: (staff) => {
      queryClient.setQueryData(keys.staff, staff);
      toast.success("Invitación enviada");
    },
  });
}

export function useUpdateStaffRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: StaffRole[] }) =>
      unwrap(api.PUT("/api/v1/admin/staff/{staff_id}/roles", { params: { path: { staff_id: id } }, body: { roles } })),
    onSuccess: (staff) => queryClient.setQueryData(keys.staff, staff),
  });
}

export function useRevokeStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/staff/{staff_id}", { params: { path: { staff_id: id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.staff });
      toast.success("Acceso revocado");
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: keys.me, queryFn: () => unwrap(api.GET("/api/v1/me")) });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => unwrap(api.PATCH("/api/v1/me", { body })),
    onSuccess: (me) => {
      queryClient.setQueryData(keys.me, me);
      void queryClient.invalidateQueries({ queryKey: sessionKey });
      toast.success("Perfil actualizado");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      unwrap(api.POST("/api/v1/me/password", { body })),
    // El backend cierra todas las sesiones: hay que volver a ingresar.
    onSuccess: () => window.location.replace("/login"),
    meta: { silent: true },
  });
}
