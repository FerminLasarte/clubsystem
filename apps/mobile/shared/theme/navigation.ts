import { colors, typography } from "./tokens";

/** Estilo común de los headers de los navegadores (Stack y Tabs). */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontSize: typography.subheading.fontSize, fontWeight: "600" },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;
