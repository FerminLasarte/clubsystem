import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reservationKeys } from "@/features/reservations/api";

import { bookingApi, bookingKeys, type AvailabilityParams, type NewReservation } from "./api";

/** Canchas activas del club (de acá salen los deportes que se pueden reservar). */
export function useClubCourts(clubId: string | undefined) {
  return useQuery({
    queryKey: bookingKeys.courts(clubId ?? ""),
    queryFn: clubId ? ({ signal }) => bookingApi.courts(clubId, signal) : skipToken,
  });
}

/** Turnos libres por cancha con el precio final. El backend calcula disponibilidad y precio. */
export function useAvailability(params: AvailabilityParams | null) {
  return useQuery({
    queryKey: params ? bookingKeys.availability(params) : bookingKeys.availabilityOfClub(""),
    queryFn: params ? ({ signal }) => bookingApi.availability(params, signal) : skipToken,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (r: NewReservation) => bookingApi.create(r),
    // Haya salido bien o el turno ya estuviera tomado (409), la disponibilidad cambió.
    onSettled: (_data, _error, r) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.availabilityOfClub(r.clubId) }),
        queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
      ]),
  });
}
