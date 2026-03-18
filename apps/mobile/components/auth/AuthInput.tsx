/**
 * AuthInput — Input estilizado para las pantallas de autenticación.
 * Incluye icono Feather a la izquierda y estado de foco con borde de color.
 */

import { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius, Spacing } from "@/constants/theme";

const C = Colors.light;

interface AuthInputProps extends TextInputProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

export const AuthInput = forwardRef<TextInput, AuthInputProps>(
  ({ label, icon, style, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <Feather
            name={icon}
            size={16}
            color={focused ? C.tint : C.placeholder}
          />
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={C.placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          />
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
    letterSpacing: 0.1,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: Radius.md,
    backgroundColor: C.surface,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputWrapFocused: {
    borderColor: C.borderFocus,
    backgroundColor: C.background,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: C.text,
    height: "100%" as unknown as number,
  },
});
