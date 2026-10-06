import type { MyMembershipOut } from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@/features/auth/api";

import { clubKeys, clubsApi } from "./api";

/** Directorio de clubes; la búsqueda la hace el servidor. */
export function useClubsDirectory(search: string) {
  return useQuery({
    queryKey: clubKeys.directory(search),
    queryFn: ({ signal }) => clubsApi.directory(search, signal),
    placeholderData: keepPreviousData,
  });
}

/** Mis membresías (con club y plan). Fuente de verdad de "de qué clubes soy socio". */
export function useMyMemberships() {
  return useQuery({ queryKey: clubKeys.memberships, queryFn: clubsApi.memberships });
}

export function approvedMemberships(memberships: MyMembershipOut[] | undefined): MyMembershipOut[] {
  return (memberships ?? []).filter((m) => m.status === "APPROVED");
}

export function useRequestMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) => clubsApi.requestMembership(clubId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: clubKeys.all }),
        queryClient.invalidateQueries({ queryKey: authKeys.session }),
      ]),
  });
}
