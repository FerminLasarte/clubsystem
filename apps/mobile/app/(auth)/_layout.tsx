import { Stack } from "expo-router";

import { headerOptions } from "@/shared/theme/navigation";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ ...headerOptions, headerBackTitle: "Volver" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Crear cuenta" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Recuperar contraseña" }} />
    </Stack>
  );
}
