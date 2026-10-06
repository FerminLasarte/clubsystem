import { unwrap, type RegisterRequest } from "@clubsystem/api";

import { api } from "@/shared/api/client";

export const authKeys = {
  session: ["auth", "session"] as const,
};

export const authApi = {
  login: (email: string, password: string) =>
    unwrap(api.POST("/api/v1/auth/mobile/login", { body: { email, password } })),
  register: (body: RegisterRequest) => unwrap(api.POST("/api/v1/auth/register", { body })),
  session: () => unwrap(api.GET("/api/v1/auth/mobile/session")),
  logout: () => unwrap(api.POST("/api/v1/auth/logout")),
  forgotPassword: (email: string) => unwrap(api.POST("/api/v1/auth/password/forgot", { body: { email } })),
  resendVerification: () => unwrap(api.POST("/api/v1/auth/verify-email/resend")),
};
