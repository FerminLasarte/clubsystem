import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { useAuthStatus } from "@/features/auth/hooks";
import { makeQueryClient, syncFocusWithAppState } from "@/shared/api/query-client";
import { initMonitoring } from "@/shared/lib/monitoring";
import { colors } from "@/shared/theme/tokens";

initMonitoring();

function RootNavigator() {
  const status = useAuthStatus();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const [queryClient] = useState(makeQueryClient);
  useEffect(syncFocusWithAppState, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Mide el arranque y deja los toques como breadcrumbs; los errores no manejados los toma el handler
// global de Sentry. Sin initMonitoring() no hace nada.
export default Sentry.wrap(RootLayout);
