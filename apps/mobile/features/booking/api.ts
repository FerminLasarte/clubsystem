import { unwrap, type AppDuration, type Sport } from "@clubsystem/api";
import { todayIn } from "@clubsystem/shared";

import { api } from "@/shared/api/client";
import { deviceTimeZone } from "@/shared/lib/time";

export interface AvailabilityParams {
  clubId: string;
  date: string;
  sport: Sport;
  duration: AppDuration;
}

export interface NewReservation {
  clubId: string;
  courtId: string;
  startsAt: string;
  duration: AppDuration;
}

export const bookingKeys = {
  courts: (clubId: string) => ["booking", "courts", clubId] as const,
  timeZone: (clubId: string) => ["booking", "timezone", clubId] as const,
  availabilityOfClub: (clubId: string) => ["booking", "availability", clubId] as const,
  availability: (p: AvailabilityParams) => ["booking", "availability", p.clubId, p.date, p.sport, p.duration] as const,
};

export const bookingApi = {
  courts: (clubId: string, signal?: AbortSignal) =>
    unwrap(api.GET("/api/v1/mobile/clubs/{club_id}/courts", { params: { path: { club_id: clubId } }, signal })),
  availability: (p: AvailabilityParams, signal?: AbortSignal) =>
    unwrap(
      api.GET("/api/v1/mobile/clubs/{club_id}/availability", {
        params: { path: { club_id: p.clubId }, query: { date: p.date, sport: p.sport, duration: p.duration } },
        signal,
      }),
    ),
  /** Hoy según el dispositivo alcanza: solo interesa el campo `timezone` de la respuesta. */
  timeZone: async (clubId: string, signal?: AbortSignal) => {
    const availability = await unwrap(
      api.GET("/api/v1/mobile/clubs/{club_id}/availability", {
        params: { path: { club_id: clubId }, query: { date: todayIn(deviceTimeZone()) } },
        signal,
      }),
    );
    return availability.timezone;
  },
  create: (r: NewReservation) =>
    unwrap(
      api.POST("/api/v1/mobile/clubs/{club_id}/reservations", {
        params: { path: { club_id: r.clubId } },
        body: { court_id: r.courtId, starts_at: r.startsAt, duration_minutes: r.duration },
      }),
    ),
};
