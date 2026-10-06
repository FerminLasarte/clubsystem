import { FlatList, StyleSheet, View } from "react-native";

import { spacing } from "@/shared/theme/tokens";

import { Chip } from "./Chip";
import { Text } from "./Text";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  detail?: string;
}

interface ChipSelectorProps<T extends string | number> {
  title: string;
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

/** Fila horizontal de opciones con una sola seleccionada. */
export function ChipSelector<T extends string | number>({ title, options, value, onChange }: ChipSelectorProps<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text variant="label">{title}</Text>
      <FlatList
        horizontal
        data={options}
        keyExtractor={(o) => String(o.value)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Chip label={item.label} detail={item.detail} selected={item.value === value} onPress={() => onChange(item.value)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
});
