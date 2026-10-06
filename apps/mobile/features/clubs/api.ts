import { unwrap } from "@clubsystem/api";

import { api } from "@/shared/api/client";

export const clubKeys = {
  all: ["clubs"] as const,
  directory: (search: string) => ["clubs", "directory", search] as const,
  memberships: ["clubs", "memberships"] as const,
};

export const clubsApi = {
  directory: (search: string, signal?: AbortSignal) =>
    unwrap(api.GET("/api/v1/mobile/clubs", { params: { query: search ? { search } : {} }, signal })),
  memberships: () => unwrap(api.GET("/api/v1/mobile/memberships")),
  acceptInvitation: (membershipId: string) =>
    unwrap(
      api.POST("/api/v1/mobile/memberships/{membership_id}/accept", {
        params: { path: { membership_id: membershipId } },
      }),
    ),
  declineInvitation: (membershipId: string) =>
    unwrap(
      api.POST("/api/v1/mobile/memberships/{membership_id}/decline", {
        params: { path: { membership_id: membershipId } },
      }),
    ),
  requestMembership: (clubId: string) =>
    unwrap(api.POST("/api/v1/mobile/clubs/{club_id}/membership-requests", { params: { path: { club_id: clubId } } })),
};
