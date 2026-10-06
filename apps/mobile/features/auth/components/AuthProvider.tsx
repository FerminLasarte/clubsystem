import { useQueryClient } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";

import { restoreSession } from "@/shared/api/client";

import { useAuthStatus } from "../hooks";

void SplashScreen.preventAutoHideAsync();

/**
 * Restaura la sesión guardada al abrir la app (con el splash visible) y limpia la caché
 * cuando la sesión termina, para que el próximo usuario no vea datos del anterior.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useAuthStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    void SplashScreen.hideAsync();
    if (status === "signedOut") queryClient.clear();
  }, [status, queryClient]);

  return children;
}
