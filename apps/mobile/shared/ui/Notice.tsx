import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, tones, type Tone } from "@/shared/theme/tokens";

import { Text } from "./Text";

interface NoticeProps {
  title?: string;
  message: string;
  tone?: Tone;
  children?: ReactNode;
}

/** Aviso destacado (email sin verificar, reserva pendiente, errores de un formulario). */
export function Notice({ title, message, tone = "neutral", children }: NoticeProps) {
  const { background, text } = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: colors[background] }]} accessibilityRole="alert">
      {title ? (
        <Text variant="label" color={tone === "neutral" ? "text" : text}>
          {title}
        </Text>
      ) : null}
      <Text variant="caption" color={text}>
        {message}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
});
