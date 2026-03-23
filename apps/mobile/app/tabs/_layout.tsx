/**
 * Tab Navigation — Portal del Jugador
 * =====================================
 * Layout principal de la app. Tres pestañas minimalistas (Stripe-like):
 *
 *   Inicio     → app/tabs/index.tsx      (ícono: home)
 *   Reservar   → app/tabs/reservations.tsx (ícono: calendar)
 *   Perfil     → app/tabs/profile.tsx    (ícono: user)
 *
 * Diseño del Tab Bar:
 *   - Fondo blanco puro sobre el lienzo gris de la app.
 *   - Sin `borderTop` rígido — reemplazado por sombra ultra sutil (iOS) / elevation (Android).
 *   - Tint activo: Colors.primary. Inactivo: Colors.textMuted.
 *   - Labels pequeñas (11px, 600) alineadas debajo del ícono.
 */

import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";

// ── Ícono de pestaña ─────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({ name, color, focused }: { name: FeatherName; color: string; focused: boolean }) {
  // Cuando está activo el ícono es ligeramente más grande para reforzar el estado
  return <Feather name={name} size={focused ? 22 : 21} color={color} />;
}

// ── Layout ───────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ── Colores ──────────────────────────────────────────
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,

        // ── Label ────────────────────────────────────────────
        tabBarLabelStyle: {
          fontSize:     11,
          fontWeight:   "600",
          marginBottom: Platform.OS === "android" ? 4 : 0,
          letterSpacing: 0.1,
        },

        // ── Barra inferior ───────────────────────────────────
        // borderTopWidth: 0 elimina la línea gris nativa.
        // La sombra crea la separación del contenido sin rigidez.
        tabBarStyle: {
          backgroundColor: Colors.cardBackground,
          borderTopWidth:  0,
          ...Platform.select({
            ios: {
              shadowColor:   Colors.shadow,
              shadowOffset:  { width: 0, height: -3 },
              shadowOpacity: 0.07,
              shadowRadius:  10,
            },
            android: {
              elevation: 8,
            },
          }),
        },
      }}
    >
      {/* ── Inicio ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Reservar ── */}
      <Tabs.Screen
        name="reservations"
        options={{
          title: "Reservar",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Perfil ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
