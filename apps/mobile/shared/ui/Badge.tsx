import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, tones, type Tone } from "@/shared/theme/tokens";

import { Text } from "./Text";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { background, text } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[background] }]}>
      <Text variant="small" color={text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
});
