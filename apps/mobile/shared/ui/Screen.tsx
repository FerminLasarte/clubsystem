import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors, spacing } from "@/shared/theme/tokens";

interface ScreenProps {
  children: ReactNode;
  /** Contenido con scroll y teclado (formularios, detalles). Las listas usan FlatList sin `scroll`. */
  scroll?: boolean;
  /** Bordes con safe area. Las pantallas con header del navegador no necesitan el de arriba. */
  edges?: Edge[];
}

export function Screen({ children, scroll = false, edges = [] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={screenContent.padded}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

/** Espaciado estándar del contenido (también para `contentContainerStyle` de las FlatList). */
export const screenContent = StyleSheet.create({
  padded: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
