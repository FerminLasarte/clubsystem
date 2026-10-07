import { ApiError } from "@clubsystem/api";
import { focusManager, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { reportError } from "@/shared/lib/monitoring";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Los 4xx no se reintentan: el resultado no va a cambiar.
        retry: (count, error) =>
          count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
    // Las pantallas muestran el error; acá se reporta el inesperado (5xx o bug) al monitoreo.
    queryCache: new QueryCache({ onError: reportError }),
    mutationCache: new MutationCache({ onError: reportError }),
  });
}

/** En React Native "volver a la app" es el equivalente al foco de la ventana: refresca lo que esté viejo. */
export function syncFocusWithAppState(): () => void {
  if (Platform.OS === "web") return () => undefined;
  const subscription = AppState.addEventListener("change", (state) => {
    focusManager.setFocused(state === "active");
  });
  return () => subscription.remove();
}
