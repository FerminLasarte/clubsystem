import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      {/*
        Sin Stack.Screen explícitos: Expo Router descubre las rutas
        automáticamente. Declarar nombres incorrectos causa warnings.
      */}
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
