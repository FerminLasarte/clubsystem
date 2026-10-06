import { unwrap } from "@clubsystem/api";

import { api } from "@/shared/api/client";

export type ReservationScope = "upcoming" | "past";

export const PAGE_SIZE = 20;

export const reservationKeys = {
  all: ["reservations"] as const,
  list: (scope: ReservationScope, pageSize: number) => ["reservations", "list", scope, pageSize] as const,
  upcomingPreview: (limit: number) => ["reservations", "upcoming-preview", limit] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
};

export const reservationsApi = {
  list: (scope: ReservationScope, page: number, pageSize: number, signal?: AbortSignal) =>
    unwrap(api.GET("/api/v1/mobile/reservations", { params: { query: { scope, page, page_size: pageSize } }, signal })),
  detail: (id: string, signal?: AbortSignal) =>
    unwrap(api.GET("/api/v1/mobile/reservations/{reservation_id}", { params: { path: { reservation_id: id } }, signal })),
};
