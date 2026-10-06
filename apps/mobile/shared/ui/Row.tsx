import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "@/shared/theme/tokens";

interface RowProps {
  children: ReactNode;
  /** `between`: extremos (título + badge). `start`: uno al lado del otro, con salto de línea. */
  justify?: "between" | "start";
}

export function Row({ children, justify = "between" }: RowProps) {
  return <View style={[styles.row, justify === "between" ? styles.between : styles.start]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  between: {
    justifyContent: "space-between",
  },
  start: {
    flexWrap: "wrap",
  },
});
