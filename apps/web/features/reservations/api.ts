import {
  unwrap,
  type CustomerType,
  type ReservationCreate,
  type ReservationOut,
  type ReservationStatus,
  type ReservationUpdate,
} from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const HISTORY_PAGE_SIZE = 25;

export interface HistoryFilters {
  from: string;
  to: string;
  status: ReservationStatus | null;
  courtId: string | null;
  page: number;
}

export interface QuoteParams {
  court_id: string;
  starts_at: string;
  ends_at: string;
  customer_type: CustomerType;
}

export const reservationKeys = {
  all: ["reservations"] as const,
  grid: (day: string) => ["reservations", "grid", day] as const,
  pending: (day: string) => ["reservations", "pending", day] as const,
  history: (filters: HistoryFilters) => ["reservations", "history", filters] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
  quote: (params: QuoteParams | null) => ["reservations", "quote", params] as const,
};

export function useReservationGrid(day: string) {
  return useQuery({
    queryKey: reservationKeys.grid(day),
    queryFn: () => unwrap(api.GET("/api/v1/admin/reservations/grid", { params: { query: { date: day } } })),
    placeholderData: keepPreviousData,
  });
}

/** Cantidad de reservas pendientes de confirmar de un día (llegan desde la app y vencen al empezar). */
export function usePendingCount(day: string) {
  return useQuery({
    queryKey: reservationKeys.pending(day),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/reservations", {
          params: { query: { date: day, status: "pending", page_size: 1 } },
        }),
      ),
    select: (page) => page.total,
  });
}

export function useReservationHistory(filters: HistoryFilters) {
  return useQuery({
    queryKey: reservationKeys.history(filters),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/reservations", {
          params: {
            query: {
              from: filters.from,
              to: filters.to,
              status: filters.status,
              court_id: filters.courtId,
              sort: "-starts_at",
              page: filters.page,
              page_size: HISTORY_PAGE_SIZE,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: reservationKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/reservations/{reservation_id}", { params: { path: { reservation_id: id ?? "" } } }),
      ),
    enabled: id !== null,
  });
}

/** Precio de tarifa de una reserva antes de crearla (lo calcula el backend). `null` mientras falten datos. */
export function useReservationQuote(params: QuoteParams | null) {
  return useQuery({
    queryKey: reservationKeys.quote(params),
    queryFn: params
      ? () => unwrap(api.GET("/api/v1/admin/reservations/quote", { params: { query: params } }))
      : skipToken,
    placeholderData: keepPreviousData,
    select: (quote) => quote.total_price,
  });
}

function useOnReservationChange() {
  const queryClient = useQueryClient();
  return (reservation: ReservationOut) => {
    queryClient.setQueryData(reservationKeys.detail(reservation.id), reservation);
    void queryClient.invalidateQueries({ queryKey: reservationKeys.all });
  };
}

export function useCreateReservation() {
  const onChange = useOnReservationChange();
  return useMutation({
    mutationFn: (body: ReservationCreate) => unwrap(api.POST("/api/v1/admin/reservations", { body })),
    onSuccess: (reservation) => {
      onChange(reservation);
      toast.success(`Reserva creada · ${formatMoney(reservation.total_price)}`);
    },
    // Solapamiento (409) y horario (422) se muestran dentro del diálogo.
    meta: { silent: true },
  });
}

export function useUpdateReservation() {
  const onChange = useOnReservationChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReservationUpdate }) =>
      unwrap(
        api.PATCH("/api/v1/admin/reservations/{reservation_id}", {
          params: { path: { reservation_id: id } },
          body,
        }),
      ),
    onSuccess: onChange,
    meta: { silent: true },
  });
}

export function useConfirmReservation() {
  const onChange = useOnReservationChange();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/reservations/{reservation_id}/confirm", { params: { path: { reservation_id: id } } }),
      ),
    onSuccess: (reservation) => {
      onChange(reservation);
      toast.success("Reserva confirmada");
    },
  });
}

export function useCancelReservation() {
  const onChange = useOnReservationChange();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/reservations/{reservation_id}/cancel", { params: { path: { reservation_id: id } } }),
      ),
    onSuccess: (reservation) => {
      onChange(reservation);
      toast.success("Reserva cancelada");
    },
  });
}

/** CSV de reservas de un rango de fechas (para `ExportButton`). */
export function exportReservationsCsv(from: string, to: string) {
  return api.GET("/api/v1/admin/reservations/export", { params: { query: { from, to } }, parseAs: "blob" });
}
