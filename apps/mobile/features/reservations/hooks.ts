import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

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

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: ({ signal }) => reservationsApi.detail(id, signal),
  });
}
