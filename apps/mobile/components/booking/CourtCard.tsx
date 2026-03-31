/**
 * CourtCard — Tarjeta de cancha disponible para reservar.
 *
 * Muestra la información de una cancha específica para la combinación
 * exacta de [día + horario + duración] seleccionada:
 *   - Nombre de la cancha
 *   - Tipo de superficie y condición (cubierta / descubierta)
 *   - Precio total para la duración elegida
 *
 * Estados visuales:
 *   - Normal   → Card blanca con sombra sutil
 *   - Seleccionada → borde azul marino, fondo primarySubtle, badge de check
 */

import React from "react";
import {
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Card }   from "@/components/Card";
import { Text }   from "@/components/ui/Text";

// ── Tipos ────────────────────────────────────────────────────

interface CourtCardProps {
  courtName:  string;
  surface:    string | null;
  isIndoor:   boolean;
  startTime:  string;
  endTime:    string;
  totalPrice: number;
  isSelected: boolean;
  onPress:    () => void;
}

// ── Helpers ──────────────────────────────────────────────────

const SURFACE_LABELS: Record<string, string> = {
  cement:    "Cemento",
  clay:      "Polvo de ladrillo",
  grass:     "Grass",
  carpet:    "Carpeta",
  synthetic: "Sintético",
  wood:      "Madera",
  other:     "Otro",
};

function formatSurface(surface: string | null): string {
  if (!surface) return "Superficie";
  return SURFACE_LABELS[surface.toLowerCase()] ?? surface;
}

// ── Componente ───────────────────────────────────────────────

export function CourtCard({
  courtName,
  surface,
  isIndoor,
  startTime,
  endTime,
  totalPrice,
  isSelected,
  onPress,
}: CourtCardProps) {
  const priceFormatted = `$${totalPrice.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  })}`;

  return (
    <Card
      onPress={onPress}
      padding={0}
      style={isSelected ? styles.cardSelected : undefined}
    >
      <View style={styles.inner}>

        {/* ── Columna izquierda: info ── */}
        <View style={styles.infoCol}>

          {/* Nombre + check badge */}
          <View style={styles.nameRow}>
            <Text
              variant="subheading"
              weight="700"
              numberOfLines={1}
              style={[styles.courtName, isSelected && styles.courtNameSelected]}
            >
              {courtName}
            </Text>
            {isSelected && (
              <View style={styles.checkBadge}>
                <Feather name="check" size={11} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Badges: superficie + cubierta/descubierta */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Feather
                name="layers"
                size={10}
                color={Colors.textMuted}
                style={styles.badgeIcon}
              />
              <Text variant="label" style={styles.badgeText}>
                {formatSurface(surface)}
              </Text>
            </View>

            <View style={styles.badge}>
              <Feather
                name={isIndoor ? "home" : "sun"}
                size={10}
                color={Colors.textMuted}
                style={styles.badgeIcon}
              />
              <Text variant="label" style={styles.badgeText}>
                {isIndoor ? "Cubierta" : "Descubierta"}
              </Text>
            </View>
          </View>

          {/* Rango horario */}
          <Text variant="label" style={styles.timeRange}>
            {startTime} → {endTime}
          </Text>
        </View>

        {/* ── Columna derecha: precio ── */}
        <View style={styles.priceCol}>
          <Text
            variant="heading"
            weight="800"
            style={[styles.price, isSelected && styles.priceSelected]}
          >
            {priceFormatted}
          </Text>
          <Text variant="label" style={styles.priceLabel}>
            total
          </Text>
        </View>

      </View>
    </Card>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardSelected: {
    borderColor:     Colors.primaryBorder,
    borderWidth:     1.5,
    backgroundColor: Colors.primarySubtle,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.primary,
        shadowOpacity: 0.10,
        shadowRadius:  12,
      },
      android: { elevation: 4 },
    }),
  },

  inner: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 18,
    paddingVertical:   16,
    gap:               12,
  },

  // ── Info col ───────────────────────────────────────────────
  infoCol: {
    flex: 1,
    gap:  6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  courtName: {
    color:         Colors.text,
    fontSize:      15,
    letterSpacing: -0.2,
    flexShrink:    1,
  },
  courtNameSelected: {
    color: Colors.primary,
  },

  // ── Badges ────────────────────────────────────────────────
  badgeRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           6,
  },
  badge: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
    gap:               4,
  },
  badgeIcon: {
    opacity: 0.7,
  },
  badgeText: {
    color:    Colors.textMuted,
    fontSize: 10,
  },

  // ── Rango horario ─────────────────────────────────────────
  timeRange: {
    color:         Colors.placeholder,
    fontSize:      11,
    letterSpacing: 0.1,
  },

  // ── Price col ─────────────────────────────────────────────
  priceCol: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  price: {
    color:         Colors.primary,
    fontSize:      20,
    letterSpacing: -0.5,
  },
  priceSelected: {
    color: Colors.primary,
  },
  priceLabel: {
    color:    Colors.placeholder,
    fontSize: 10,
  },

  // ── Check badge ───────────────────────────────────────────
  checkBadge: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: Colors.primary,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
});
