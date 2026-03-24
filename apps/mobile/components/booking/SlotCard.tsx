/**
 * SlotCard — Tarjeta de horario para la grilla de reservas.
 *
 * Tres estados visuales:
 *   1. Disponible  → Card blanca con sombra sutil. Precio en verde.
 *   2. Seleccionado → Card verde deportivo (#10B981), texto blanco, badge de check.
 *                    Micro-animación scale 1.04x con react-native-reanimated.
 *                    Feedback háptico ligero (expo-haptics ImpactLight).
 *   3. Ocupado / Insuficiente → Fondo gris ultra sutil, opacidad 0.45,
 *                    patrón de líneas diagonales finas para indicar indisponibilidad
 *                    sin saturar la vista.
 */

import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Text }   from "@/components/ui/Text";

// ── Tipos ────────────────────────────────────────────────────

interface SlotCardProps {
  startTime:      string;   // "18:00"
  endTime:        string;   // "19:30" (ya calculado: start + duration)
  totalPrice:     number;
  isAvailable:    boolean;  // el bloque base está libre
  canSelect:      boolean;  // hay N bloques consecutivos disponibles
  isSelected:     boolean;
  onPress:        () => void;
}

// ── Patrón de líneas diagonales para slots ocupados ─────────

const STRIPE_COUNT = 6;

function DiagonalStripes() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            { top: (i * 100) / STRIPE_COUNT + "%" as `${number}%` },
          ]}
        />
      ))}
    </View>
  );
}

// ── Componente ───────────────────────────────────────────────

export function SlotCard({
  startTime,
  endTime,
  totalPrice,
  isAvailable,
  canSelect,
  isSelected,
  onPress,
}: SlotCardProps) {
  const isDisabled = !isAvailable || !canSelect;
  const scale      = useSharedValue(1);

  // Bounce in quando viene selezionado
  useEffect(() => {
    if (isSelected) {
      scale.value = withSpring(1.04, { damping: 10, stiffness: 200 });
      scale.value = withSpring(1,    { damping: 12, stiffness: 180 });
    }
  }, [isSelected, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (isDisabled) return;
    // Haptic light feedback al tocar un slot disponible
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Micro-animación de press
    scale.value = withSpring(0.97, { damping: 10, stiffness: 250 });
    scale.value = withSpring(1,    { damping: 12, stiffness: 180 });
    onPress();
  };

  const priceFormatted = `$${totalPrice.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  })}`;

  const statusLabel = isAvailable ? "Insuficiente" : "Ocupado";

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        isDisabled
          ? `${startTime} — ${statusLabel}`
          : `${startTime} a ${endTime}, ${priceFormatted}`
      }
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          styles.card,
          isDisabled  && styles.cardDisabled,
          isSelected  && styles.cardSelected,
          animatedStyle,
        ]}
      >
        {/* Patrón diagonal en ocupados */}
        {isDisabled && <DiagonalStripes />}

        {/* Badge de check para seleccionado */}
        {isSelected && (
          <View style={styles.checkBadge}>
            <Feather name="check" size={10} color="#FFFFFF" />
          </View>
        )}

        {/* Hora inicio */}
        <Text
          variant="heading"
          weight="800"
          style={[
            styles.timeStart,
            isDisabled && styles.textDisabled,
            isSelected && styles.textSelected,
          ]}
        >
          {startTime}
        </Text>

        {/* Hora fin */}
        <Text
          variant="label"
          style={[
            styles.timeEnd,
            isDisabled && styles.textDisabled,
            isSelected && styles.textSelectedMuted,
          ]}
        >
          → {endTime}
        </Text>

        {/* Precio / estado */}
        {isDisabled ? (
          <Text variant="label" style={styles.occupiedTag}>
            {statusLabel}
          </Text>
        ) : (
          <Text
            variant="caption"
            weight="700"
            style={[styles.price, isSelected && styles.textSelected]}
          >
            {priceFormatted}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const cardElevation = Platform.select({
  ios: {
    shadowColor:   Colors.shadow,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
  },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },

  // ── Card states ──────────────────────────────────────────
  card: {
    flex:            1,
    backgroundColor: Colors.cardBackground,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    gap:             4,
    position:        "relative",
    overflow:        "hidden",
    ...cardElevation,
  },
  cardDisabled: {
    backgroundColor: Colors.surface,
    borderColor:     Colors.border,
    opacity:         0.45,
  },
  cardSelected: {
    backgroundColor: Colors.accent,
    borderColor:     Colors.accent,
    // Sombra más pronunciada al seleccionar
    ...Platform.select({
      ios: {
        shadowColor:   Colors.accent,
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius:  10,
      },
      android: { elevation: 6 },
    }),
  },

  // ── Check badge ──────────────────────────────────────────
  checkBadge: {
    position:        "absolute",
    top:             10,
    right:           10,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Texto ────────────────────────────────────────────────
  timeStart: {
    color:         Colors.text,
    letterSpacing: -0.5,
    fontSize:      17,
  },
  timeEnd: {
    color:    Colors.textMuted,
    fontSize: 11,
  },
  price: {
    color:     Colors.accent,
    marginTop: 4,
    fontSize:  12,
  },
  occupiedTag: {
    color:     Colors.placeholder,
    marginTop: 4,
    fontSize:  10,
    letterSpacing: 0.2,
  },
  textDisabled: {
    color: Colors.placeholder,
  },
  textSelected: {
    color: "#FFFFFF",
  },
  textSelectedMuted: {
    color: "rgba(255,255,255,0.7)",
  },

  // ── Diagonal stripes ──────────────────────────────────────
  stripe: {
    position:        "absolute",
    left:            -20,
    right:           -20,
    height:          1,
    backgroundColor: Colors.border,
    transform:       [{ rotate: "-35deg" }],
  },
});
