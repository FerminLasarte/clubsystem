import { unwrap, type ProfileUpdate } from "@clubsystem/api";

import { api } from "@/shared/api/client";

export const profileKeys = {
  me: ["profile", "me"] as const,
};

export const profileApi = {
  me: () => unwrap(api.GET("/api/v1/me")),
  update: (body: ProfileUpdate) => unwrap(api.PATCH("/api/v1/me", { body })),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(api.POST("/api/v1/me/password", { body: { current_password: currentPassword, new_password: newPassword } })),
};
