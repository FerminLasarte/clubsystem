import type { MobileSessionOut, RegisterRequest } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { session, type AuthStatus } from "@/shared/api/session";

import { authApi, authKeys } from "./api";

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(session.subscribe, session.getStatus);
}

/** Usuario y membresías de la sesión (se refresca al volver a la app). */
export function useSession() {
  return useQuery({ queryKey: authKeys.session, queryFn: authApi.session });
}

async function startSession(queryClient: QueryClient, data: MobileSessionOut): Promise<void> {
  queryClient.setQueryData(authKeys.session, { user: data.user, memberships: data.memberships });
  await session.start(data);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      authApi.login(identifier, password),
    onSuccess: (data) => startSession(queryClient, data),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (data) => startSession(queryClient, data),
  });
}

/** Revoca la sesión en el backend y, salga como salga, cierra la sesión local. */
export function useLogout() {
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => session.end(),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}
