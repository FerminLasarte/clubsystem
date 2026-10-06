import { ApiError } from "@clubsystem/api";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

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
