import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

/**
 * Punto de entrada de la app.
 * Mientras se restaura la sesión desde SecureStore muestra un spinner.
 * Luego redirige al flujo correcto sin un flash de pantalla incorrecta.
 */
export default function Index() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  if (token) return <Redirect href="/tabs" />;
  return <Redirect href="/(auth)/login" />;
}
