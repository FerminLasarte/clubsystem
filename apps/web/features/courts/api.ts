import { unwrap, type CourtCreate, type CourtUpdate } from "@clubsystem/api";
import { pluralize } from "@clubsystem/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const courtKeys = {
  all: ["courts"] as const,
  upcoming: (id: string) => ["courts", id, "upcoming-reservations"] as const,
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

/**
 * Activar o desactivar. Silenciosa: la tabla maneja el 409 `court_has_upcoming_reservations`
 * ofreciendo desactivar cancelando las reservas, y muestra el resto de los errores.
 */
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
    meta: { silent: true },
  });
}

/** Reservas que se cancelarían al desactivar la cancha (solo mientras el diálogo está abierto). */
export function useCourtUpcomingReservations(id: string | null) {
  return useQuery({
    queryKey: courtKeys.upcoming(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/courts/{court_id}/upcoming-reservations", { params: { path: { court_id: id ?? "" } } }),
      ),
    enabled: id !== null,
    staleTime: 0,
  });
}

/** Cancela las reservas próximas y desactiva. `expected` es la cantidad que confirmó el usuario. */
export function useDeactivateCourt() {
  const invalidate = useInvalidateCourts();
  return useMutation({
    mutationFn: ({ id, expected }: { id: string; expected: number }) =>
      unwrap(
        api.POST("/api/v1/admin/courts/{court_id}/deactivate", {
          params: { path: { court_id: id } },
          body: { cancel_upcoming_reservations: expected },
        }),
      ),
    onSuccess: ({ court, cancelled_reservations }) => {
      toast.success(
        `"${court.name}" desactivada · ${pluralize(cancelled_reservations, "reserva cancelada", "reservas canceladas")}`,
      );
    },
    // Si la cantidad cambió (409), el diálogo vuelve a pedir el número actualizado.
    onSettled: invalidate,
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
