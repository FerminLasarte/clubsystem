import type { ProfileUpdate } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@/features/auth/api";
import { session } from "@/shared/api/session";

import { profileApi, profileKeys } from "./api";

export function useProfile() {
  return useQuery({ queryKey: profileKeys.me, queryFn: profileApi.me });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => profileApi.update(body),
    onSuccess: async (user) => {
      queryClient.setQueryData(profileKeys.me, user);
      await queryClient.invalidateQueries({ queryKey: authKeys.session });
    },
  });
}

/** El backend cierra todas las sesiones al cambiar la contraseña: hay que volver a ingresar. */
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => profileApi.changePassword(current, next),
    onSuccess: () => session.end(),
  });
}
