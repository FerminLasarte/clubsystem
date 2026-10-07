import {
  unwrap,
  type ApproveRequest,
  type MemberCreate,
  type MembershipStatus,
  type MemberUpdate,
  type PlanCreate,
  type PlanUpdate,
} from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export interface MemberListFilters {
  search?: string;
  status?: MembershipStatus;
  plan_id?: string;
}

export const PAGE_SIZE = 25;
const MEMBER_SEARCH_LIMIT = 8;

/** Todo lo de socios cuelga de `all`: cualquier alta, baja o cambio de plan afecta listas y contadores. */
const keys = {
  all: ["members"] as const,
  list: (filters: MemberListFilters, page: number) => ["members", "list", filters, page] as const,
  stats: ["members", "stats"] as const,
  requests: (page: number) => ["members", "requests", page] as const,
  invitations: (page: number) => ["members", "invitations", page] as const,
  plans: ["members", "plans"] as const,
  search: (search: string, status: MembershipStatus | undefined) => ["members", "search", search, status] as const,
};

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

/** CSV del backend con los mismos filtros que la tabla (para `ExportButton`). */
export function exportMembersCsv(filters: MemberListFilters) {
  return api.GET("/api/v1/admin/members/export.csv", { params: { query: filters }, parseAs: "blob" });
}

// ── Socios ──────────────────────────────────────────────────────────────────

export function useMembers(filters: MemberListFilters, page: number) {
  return useQuery({
    queryKey: keys.list(filters, page),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/members", { params: { query: { ...filters, page, page_size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
  });
}

/** Autocompletado: búsqueda en el servidor con pocos resultados, nunca el padrón completo. */
export function useMemberSearch(search: string, status?: MembershipStatus) {
  return useQuery({
    queryKey: keys.search(search, status),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/members", { params: { query: { search, status, page_size: MEMBER_SEARCH_LIMIT } } })),
    enabled: search.length >= 2,
    select: (page) => page.items,
  });
}

export function useMemberStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => unwrap(api.GET("/api/v1/admin/members/stats")) });
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (body: MemberCreate) => unwrap(api.POST("/api/v1/admin/members", { body })),
    onSuccess: (result) => {
      void invalidate();
      // Si la persona ya había pedido ser socia, la invitación la aprueba directamente.
      toast.success(result.status === "APPROVED" ? "Solicitud aprobada" : "Invitación enviada");
    },
    meta: { silent: true },
  });
}

/** `silent`: el error lo muestra el formulario que llama (FormError) en vez de un toast. */
export function useUpdateMember({ silent = false }: { silent?: boolean } = {}) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MemberUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/members/{membership_id}", { params: { path: { membership_id: id } }, body })),
    onSuccess: () => void invalidate(),
    meta: { silent },
  });
}

// ── Invitaciones ────────────────────────────────────────────────────────────

export function useMemberInvitations(page: number) {
  return useQuery({
    queryKey: keys.invitations(page),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/members/invitations", { params: { query: { page, page_size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
  });
}

export function useCancelInvitation() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/members/invitations/{membership_id}", { params: { path: { membership_id: id } } }),
      ),
    onSuccess: () => {
      void invalidate();
      toast.success("Invitación cancelada");
    },
  });
}

// ── Solicitudes ─────────────────────────────────────────────────────────────

export function useMembershipRequests(page: number) {
  return useQuery({
    queryKey: keys.requests(page),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/membership-requests", { params: { query: { page, page_size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
  });
}

export function useApproveRequest() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ApproveRequest }) =>
      unwrap(
        api.POST("/api/v1/admin/membership-requests/{membership_id}/approve", {
          params: { path: { membership_id: id } },
          body,
        }),
      ),
    onSuccess: () => {
      void invalidate();
      toast.success("Solicitud aprobada");
    },
    meta: { silent: true },
  });
}

export function useRejectRequest() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/membership-requests/{membership_id}/reject", {
          params: { path: { membership_id: id } },
        }),
      ),
    onSuccess: () => {
      void invalidate();
      toast.success("Solicitud rechazada");
    },
  });
}

// ── Planes ──────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({ queryKey: keys.plans, queryFn: () => unwrap(api.GET("/api/v1/admin/membership-plans")) });
}

export function useCreatePlan() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (body: PlanCreate) => unwrap(api.POST("/api/v1/admin/membership-plans", { body })),
    onSuccess: () => {
      void invalidate();
      toast.success("Plan creado");
    },
    meta: { silent: true },
  });
}

/** `silent`: el error lo muestra el formulario que llama (FormError) en vez de un toast. */
export function useUpdatePlan({ silent = false }: { silent?: boolean } = {}) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PlanUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/membership-plans/{plan_id}", { params: { path: { plan_id: id } }, body })),
    // Los planes aparecen en la tabla de socios: se refresca todo.
    onSuccess: () => void invalidate(),
    meta: { silent },
  });
}

export function useDeletePlan() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/membership-plans/{plan_id}", { params: { path: { plan_id: id } } })),
    onSuccess: () => {
      void invalidate();
      // El backend responde 204 en ambos casos: si el plan tenía socios, lo desactiva.
      toast.success("Plan eliminado o, si tenía socios, desactivado");
    },
  });
}
