import { useQuery } from "@tanstack/react-query";

import { newsApi, newsKeys } from "./api";

/** Novedades vigentes de todos mis clubes. */
export function useMyNews() {
  return useQuery({ queryKey: newsKeys.mine, queryFn: newsApi.mine });
}
