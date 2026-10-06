import { ApiError, unwrap, type WebSessionOut } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const sessionKey = ["session"] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => unwrap(api.GET("/api/v1/auth/web/session")),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Sesión ya cargada (para componentes dentro del shell del panel). */
export function useActiveSession(): WebSessionOut {
  const { data } = useSession();
  if (!data) throw new Error("useActiveSession fuera del DashboardShell");
  return data;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      unwrap(api.POST("/api/v1/auth/web/login", { body })),
    onSuccess: (session) => queryClient.setQueryData(sessionKey, session),
    meta: { silent: true },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/logout")),
    onSettled: () => {
      queryClient.clear();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa: descarta todo el estado del cliente
      window.location.assign("/login");
    },
  });
}

export function useSwitchClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) =>
      unwrap(api.POST("/api/v1/auth/web/switch-club", { body: { club_id: clubId } })),
    onSuccess: (session) => {
      // Todo lo cacheado pertenece al club anterior.
      queryClient.clear();
      queryClient.setQueryData(sessionKey, session);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => unwrap(api.POST("/api/v1/auth/password/forgot", { body: { email } })),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; new_password: string }) =>
      unwrap(api.POST("/api/v1/auth/password/reset", { body })),
    meta: { silent: true },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/api/v1/auth/verify-email", { body: { token } })),
    meta: { silent: true },
  });
}

export function useInvitation(token: string) {
  return useQuery({
    queryKey: ["invitation", token],
    // POST: el token no viaja en la URL (logs de acceso).
    queryFn: () => unwrap(api.POST("/api/v1/invitations/preview", { body: { token } })),
    retry: false,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string; password: string; first_name?: string; last_name?: string }) =>
      unwrap(api.POST("/api/v1/invitations/accept", { body })),
    onSuccess: (session) => queryClient.setQueryData(sessionKey, session),
    meta: { silent: true },
  });
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
