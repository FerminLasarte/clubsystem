import { ApiError, errorMessage } from "@clubsystem/api";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
    // Toda mutación que falle avisa al usuario, salvo que la pantalla lo maneje (meta.silent).
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
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
