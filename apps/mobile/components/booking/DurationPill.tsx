/**
 * DurationPill — Pastilla de selección de duración (60 / 90 / 120 min).
 *
 * Estados visuales:
 *   - Normal   → superficie gris sutil con borde fino
 *   - Activo   → fondo verde deportivo (Colors.accent), texto blanco
 *
 * Incluye micro-animación de escala para feedback sutil en el tap.
 */

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { Text }   from "@/components/ui/Text";

// ── Tipos ────────────────────────────────────────────────────

interface DurationPillProps {
  /** Minutos: 60, 90 o 120 */
  minutes:  60 | 90 | 120;
  isActive: boolean;
  onPress:  () => void;
}

// ── Componente ───────────────────────────────────────────────

export function DurationPill({ minutes, isActive, onPress }: DurationPillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Duración ${minutes} minutos`}
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
          {minutes}
        </Text>
        <Text
          variant="label"
          weight="500"
          style={[styles.unit, isActive && styles.unitActive]}
        >
          min
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    flexDirection:     "row",
    alignItems:        "baseline",
    gap:               2,
    paddingHorizontal: 18,
    paddingVertical:   10,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor:     Colors.accent,
  },
  label: {
    fontSize:      14,
    color:         Colors.textMuted,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: "#FFFFFF",
  },
  unit: {
    fontSize: 11,
    color:    Colors.placeholder,
  },
  unitActive: {
    color: "rgba(255,255,255,0.75)",
  },
});
