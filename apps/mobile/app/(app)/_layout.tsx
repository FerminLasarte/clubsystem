import { Stack } from "expo-router";

import { headerOptions } from "@/shared/theme/navigation";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ ...headerOptions, headerBackTitle: "Volver" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="reservation/[id]" options={{ title: "Reserva" }} />
      <Stack.Screen name="profile/edit" options={{ title: "Editar datos" }} />
      <Stack.Screen name="profile/password" options={{ title: "Cambiar contraseña" }} />
    </Stack>
  );
}
