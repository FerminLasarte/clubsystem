/**
 * DatePill — Pastilla de fecha para el selector horizontal del motor de reservas.
 *
 * Estados visuales:
 *   - Normal   → superficie gris ultra sutil, texto oscuro
 *   - Activo   → azul marino primario (Colors.primary #0F172A), texto blanco
 *
 * Usa el componente <Card /> para elevación consistente con el design system.
 */

import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Text }   from "@/components/ui/Text";

// ── Tipos ────────────────────────────────────────────────────

interface DatePillProps {
  /** Etiqueta superior: "Hoy", "Mañana" o día corto "Lun" */
  dayLabel:    string;
  /** Número del día del mes */
  dayNumber:   string;
  isActive:    boolean;
  onPress:     () => void;
  /** Nombre completo del mes para accesibilidad, ej. "25 de marzo" */
  accessLabel: string;
}

// ── Componente ───────────────────────────────────────────────

export function DatePill({ dayLabel, dayNumber, isActive, onPress, accessLabel }: DatePillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 2 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessLabel}
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
          variant="label"
          weight="600"
          style={[styles.dayLabel, isActive && styles.textActive]}
        >
          {dayLabel}
        </Text>
        <Text
          variant="heading"
          weight="800"
          style={[styles.dayNumber, isActive && styles.textActive]}
        >
          {dayNumber}
        </Text>
        {isActive && <View style={styles.activeDot} />}
      </Animated.View>
    </Pressable>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    width:           58,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 10,
    borderRadius:    16,
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    gap:             2,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  dayLabel: {
    color:         Colors.textMuted,
    letterSpacing: 0.3,
    fontSize:      10,
    textTransform: "uppercase",
  },
  dayNumber: {
    color:         Colors.text,
    letterSpacing: -0.5,
  },
  textActive: {
    color: "#FFFFFF",
  },
  activeDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginTop:       2,
  },
});
