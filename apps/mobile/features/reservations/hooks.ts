import type { MyReservationOut } from "@clubsystem/api";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { bookingKeys } from "@/features/booking/api";

import { PAGE_SIZE, reservationKeys, reservationsApi, type ReservationScope } from "./api";

/** Mis reservas paginadas (para FlatList con scroll infinito). */
export function useMyReservations(scope: ReservationScope, pageSize = PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: reservationKeys.list(scope, pageSize),
    queryFn: ({ pageParam, signal }) => reservationsApi.list(scope, pageParam, pageSize, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    select: (data) => ({
      items: data.pages.flatMap((p) => p.items),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}

/** Próximas reservas para el inicio (solo la primera página, corta). */
export function useUpcomingReservations(limit: number) {
  return useQuery({
    queryKey: reservationKeys.upcomingPreview(limit),
    queryFn: ({ signal }) => reservationsApi.list("upcoming", 1, limit, signal),
  });
}

/** Cancela una reserva propia. Si se puede o no lo decide el backend (`can_cancel`). */
export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (r: Pick<MyReservationOut, "id" | "club">) => reservationsApi.cancel(r.club.id, r.id),
    onSuccess: (updated) => queryClient.setQueryData(reservationKeys.detail(updated.id), updated),
    // Salga bien o no (p. ej. venció el plazo), la reserva y el turno pueden haber cambiado.
    onSettled: (_data, _error, r) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
        queryClient.invalidateQueries({ queryKey: bookingKeys.availabilityOfClub(r.club.id) }),
      ]),
  });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: ({ signal }) => reservationsApi.detail(id, signal),
  });
}
