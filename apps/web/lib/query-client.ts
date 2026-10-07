import { ApiError, errorMessage } from "@clubsystem/api";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { reportError } from "@/lib/monitoring";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
    // Las pantallas muestran el error; acá se reporta el inesperado (5xx o bug) al monitoreo.
    queryCache: new QueryCache({ onError: reportError }),
    // Toda mutación que falle avisa al usuario, salvo que la pantalla lo maneje (meta.silent).
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        reportError(error);
        if (!mutation.meta?.silent) toast.error(errorMessage(error));
      },
    }),
  });
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
