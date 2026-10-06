import { Pressable, StyleSheet } from "react-native";

import { colors, opacity, radius, sizes, spacing } from "@/shared/theme/tokens";

import { Text } from "./Text";

interface ChipProps {
  label: string;
  /** Segunda línea opcional (por ejemplo el día del mes debajo del día de la semana). */
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Opción seleccionable (club, deporte, fecha, duración, horario). */
export function Chip({ label, detail, selected, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label} ${detail}` : label)}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text variant="label" color={selected ? "onPrimary" : "text"} align="center">
        {label}
      </Text>
      {detail ? (
        <Text variant="caption" color={selected ? "onPrimary" : "muted"} align="center">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.touch,
    minWidth: sizes.touch,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
