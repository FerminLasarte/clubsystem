import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { headerOptions } from "@/shared/theme/navigation";
import { colors } from "@/shared/theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: headerOptions.headerStyle,
        headerTitleStyle: headerOptions.headerTitleStyle,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="book" options={{ title: "Reservar", tabBarIcon: tabIcon("calendar-outline") }} />
      <Tabs.Screen name="reservations" options={{ title: "Mis reservas", tabBarIcon: tabIcon("receipt-outline") }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar", tabBarIcon: tabIcon("search-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}
