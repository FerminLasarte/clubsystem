import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { colors, opacity, radius, sizes, spacing, type ColorToken } from "@/shared/theme/tokens";

import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

const textColor: Record<Variant, ColorToken> = {
  primary: "onPrimary",
  secondary: "primary",
  ghost: "primary",
  danger: "danger",
};

export function Button({ title, onPress, variant = "primary", loading, disabled, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, inactive && styles.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={colors[textColor[variant]]} />
      ) : (
        <Text variant="label" color={textColor[variant]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.touch,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  inactive: {
    opacity: opacity.disabled,
  },
});
