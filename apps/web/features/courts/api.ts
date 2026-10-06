import { unwrap, type CourtCreate, type CourtUpdate } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const courtKeys = {
  all: ["courts"] as const,
};

/** Canchas del club, activas primero. */
export function useCourts() {
  return useQuery({ queryKey: courtKeys.all, queryFn: () => unwrap(api.GET("/api/v1/admin/courts")) });
}

function useInvalidateCourts() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: courtKeys.all });
    // La grilla de reservas lista las canchas activas.
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };
}

export function useCreateCourt() {
  const invalidate = useInvalidateCourts();
  return useMutation({
    mutationFn: (body: CourtCreate) => unwrap(api.POST("/api/v1/admin/courts", { body })),
    onSuccess: (court) => {
      invalidate();
      toast.success(`Cancha "${court.name}" creada`);
    },
    meta: { silent: true },
  });
}

export function useUpdateCourt() {
  const invalidate = useInvalidateCourts();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CourtUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/courts/{court_id}", { params: { path: { court_id: id } }, body })),
    onSuccess: (court) => {
      invalidate();
      toast.success(`Cancha "${court.name}" guardada`);
    },
    meta: { silent: true },
  });
}

/** Activar o desactivar. El 409 (reservas próximas) lo muestra el toast global con el mensaje del backend. */
export function useSetCourtActive() {
  const invalidate = useInvalidateCourts();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      unwrap(
        api.PATCH("/api/v1/admin/courts/{court_id}", {
          params: { path: { court_id: id } },
          body: { is_active: isActive },
        }),
      ),
    onSuccess: (court) => {
      invalidate();
      toast.success(court.is_active ? `"${court.name}" activada` : `"${court.name}" desactivada`);
    },
  });
}

export function useDeleteCourt() {
  const invalidate = useInvalidateCourts();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/courts/{court_id}", { params: { path: { court_id: id } } })),
    onSuccess: () => {
      invalidate();
      toast.success("Cancha eliminada");
    },
    // Con historial responde 409 ("desactivala en lugar de borrarla"): lo muestra el toast global.
  });
}
