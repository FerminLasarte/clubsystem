/**
 * SummaryBar — Panel flotante de confirmación (position: absolute bottom).
 *
 * Aparece al seleccionar un slot disponible, mostrando:
 *   • Fecha (día semana + día + mes)
 *   • Rango horario (start – end)
 *   • Duración en minutos
 *   • Precio total (socio / visitante)
 *   • Botón "Confirmar Reserva" en verde deportivo sólido
 *
 * Usa <Card /> para elevación Stripe y AnimatedValue para entrada desde abajo.
 */

import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Text }   from "@/components/ui/Text";
import { Card }   from "@/components/Card";

// ── Tipos ────────────────────────────────────────────────────

interface SummaryBarProps {
  /** Etiqueta del día: "Lun 24 mar" */
  dateLabel:    string;
  /** Hora inicio: "18:00" */
  startTime:    string;
  /** Hora fin calculada: "19:30" */
  endTime:      string;
  /** Duración seleccionada en minutos */
  duration:     number;
  /** Precio total formateado: "$3.500" */
  priceLabel:   string;
  /** Tipo de precio para sub-etiqueta */
  isMember:     boolean;
  /** Handler del botón confirmar */
  onConfirm:    () => void;
  /** Deshabilita el botón mientras se envía */
  isSubmitting: boolean;
  /** Inset bottom de safe area */
  bottomInset:  number;
}

// ── Componente ───────────────────────────────────────────────

export function SummaryBar({
  dateLabel,
  startTime,
  endTime,
  duration,
  priceLabel,
  isMember,
  onConfirm,
  isSubmitting,
  bottomInset,
}: SummaryBarProps) {
  const translateY = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue:         0,
      useNativeDriver: true,
      speed:           18,
      bounciness:      6,
    }).start();
  }, [translateY]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { paddingBottom: bottomInset + 8, transform: [{ translateY }] },
      ]}
    >
      <Card style={styles.card} padding={0} noShadow={false}>
        {/* ── Resumen de info ── */}
        <View style={styles.infoRow}>
          {/* Fecha + hora */}
          <View style={styles.infoBlock}>
            <Text variant="label" muted style={styles.infoMeta}>
              {dateLabel}
            </Text>
            <Text variant="heading" weight="700" style={styles.infoMain}>
              {startTime} – {endTime}
            </Text>
            <Text variant="label" muted>
              {duration} min
            </Text>
          </View>

          {/* Precio */}
          <View style={styles.priceBlock}>
            <Text variant="label" muted style={styles.priceType}>
              {isMember ? "Precio socio" : "Precio visitante"}
            </Text>
            <Text variant="title" weight="800" style={styles.priceValue}>
              {priceLabel}
            </Text>
          </View>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
          onPress={onConfirm}
          disabled={isSubmitting}
          activeOpacity={0.87}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Confirmar reserva"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text variant="subheading" weight="700" color="#FFFFFF">
                Confirmar Reserva
              </Text>
              <View style={styles.arrowBadge}>
                <Text variant="label" weight="700" color={Colors.textOnBrand}>
                  →
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </Card>
    </Animated.View>
  );
}

// ── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 14,
    paddingTop:        8,
    // Sombra de borde superior
    ...Platform.select({
      ios: {
        shadowColor:   Colors.shadow,
        shadowOffset:  { width: 0, height: -6 },
        shadowOpacity: 0.10,
        shadowRadius:  16,
      },
      android: { elevation: 12 },
    }),
  },
  card: {
    paddingVertical:   16,
    paddingHorizontal: 16,
    gap:               14,
    borderRadius:      20,
    overflow:          "hidden",
  },

  // ── Info row ─────────────────────────────────────────────
  infoRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-start",
  },
  infoBlock: {
    gap: 2,
  },
  infoMeta: {
    letterSpacing:  0.3,
    textTransform:  "capitalize",
  },
  infoMain: {
    letterSpacing: -0.4,
  },
  priceBlock: {
    alignItems: "flex-end",
    gap:        2,
  },
  priceType: {
    letterSpacing: 0.2,
  },
  priceValue: {
    color:         Colors.primary,
    letterSpacing: -0.6,
  },

  // ── CTA button ───────────────────────────────────────────
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius:    14,
    paddingVertical: 16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
  },
  confirmBtnDisabled: {
    opacity: 0.65,
  },
  arrowBadge: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
  },
});
