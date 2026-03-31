/**
 * TimePill — Chip de selección de horario de inicio.
 *
 * Estados visuales:
 *   - Normal  → superficie gris sutil con borde fino
 *   - Activo  → fondo azul marino (Colors.primary), texto blanco
 *
 * Micro-animación de escala al tap para feedback inmediato.
 */

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { Text }   from "@/components/ui/Text";

// ── Tipos ────────────────────────────────────────────────────

interface TimePillProps {
  /** Horario en formato "HH:MM" (ej. "09:00") */
  time:     string;
  isActive: boolean;
  onPress:  () => void;
}

// ── Componente ───────────────────────────────────────────────

export function TimePill({ time, isActive, onPress }: TimePillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Horario ${time}`}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.pill,
          isActive && styles.pillActive,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          variant="caption"
          weight="700"
          style={[styles.label, isActive && styles.labelActive]}
        >
          {time}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  label: {
    fontSize:      13,
    color:         Colors.textMuted,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: "#FFFFFF",
  },
});
