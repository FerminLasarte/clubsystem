import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

/**
 * Punto de entrada de la app mobile de socios (Portal del Jugador).
 *
 * Flujo de navegación:
 *   isLoading = true  → spinner mientras se restaura la sesión desde SecureStore
 *   token = null      → pantalla de login/registro
 *   token ≠ null      → panel principal (tabs)
 *
 * Nota: el campo `user.hasClub` y la pantalla `/pending` corresponden al flujo
 * de invitaciones de staff del panel web. En esta app mobile NO se aplican;
 * cualquier usuario autenticado accede directamente a /tabs.
 */
export default function Index() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Colors.light.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  if (!token) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/tabs" />;
}
