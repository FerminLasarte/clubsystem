import { useState, type Ref } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { colors, radius, sizes, spacing, typography } from "@/shared/theme/tokens";

import { Text } from "./Text";

interface InputProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<TextInput>;
}

export function Input({ label, error, hint, onFocus, onBlur, ref, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        // Las contraseñas nunca se corrigen ni se capitalizan.
        autoCapitalize={props.secureTextEntry ? "none" : undefined}
        autoCorrect={props.secureTextEntry ? false : undefined}
        placeholderTextColor={colors.muted}
        style={[styles.input, focused && styles.focused, !!error && styles.invalid]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.input,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  focused: {
    borderColor: colors.primary,
  },
  invalid: {
    borderColor: colors.danger,
  },
});
