/**
 * Card — Contenedor con "Elevación Stripe"
 * ==========================================
 * Pieza base del sistema de diseño premium de ClubSync.
 * Proporciona el efecto de sombra suave y difuminada que alza el contenido
 * del lienzo gris (#F7FAFC) sin usar bordes visibles llamativos.
 *
 * Sombra:
 *   iOS     → shadowOffset {0,4}, shadowOpacity 0.05, shadowRadius 12
 *             Produce un halo difuminado, como los modales de Stripe/Linear.
 *   Android → elevation 2: el valor más bajo que produce sombra visible sin
 *             el artefacto de borde grueso que aparece con elevation ≥ 4.
 *
 * Props:
 *   children  — contenido interno
 *   onPress   — si se provee, envuelve en Pressable con feedback visual (scale)
 *   style     — overrides de estilo en el contenedor (ej. backgroundColor para cards de color)
 *   padding   — padding interno; por defecto 16
 *
 * Uso:
 *   <Card>
 *     <Text>Contenido sin interacción</Text>
 *   </Card>
 *
 *   <Card onPress={() => router.push("/detail")}>
 *     <Text>Card tappable</Text>
 *   </Card>
 *
 *   <Card style={{ backgroundColor: "#F0F9FF" }} padding={12}>
 *     <Text>Card con fondo de color</Text>
 *   </Card>
 */

import React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { Colors } from "@/constants/Colors";

// ── Tipos ─────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Padding interno uniforme. Por defecto: 16 */
  padding?: number;
  /** Deshabilita completamente la sombra (útil dentro de listas con muchos items) */
  noShadow?: boolean;
}

// ── Estilos de elevación (plataforma) ────────────────────────

const elevation = Platform.select<ViewStyle>({
  ios: {
    shadowColor:   Colors.shadow,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius:  12,
  },
  android: {
    elevation: 2,
  },
  default: {},
});

// ── Componente ────────────────────────────────────────────────

export function Card({ children, onPress, style, padding = 16, noShadow = false }: CardProps) {
  const containerStyle: StyleProp<ViewStyle>[] = [
    styles.card,
    noShadow ? undefined : elevation,
    padding !== 16 ? { padding } : undefined,
    style,
  ];

  if (onPress) {
    return (
      <PressableCard onPress={onPress} style={containerStyle}>
        {children}
      </PressableCard>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

// ── Card tappable con micro-animación de escala ───────────────

interface PressableCardProps {
  children: React.ReactNode;
  onPress: () => void;
  style: StyleProp<ViewStyle>[];
}

function PressableCard({ children, onPress, style }: PressableCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 60,
      bounciness: 4,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 4,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessible
      accessibilityRole="button"
    >
      <Animated.View style={[...style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── Estilos base ──────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius:    16,
    padding:         16,
    // El borde es opcional y ultra fino — refuerza la forma sin competir con la sombra
    borderWidth:     1,
    borderColor:     Colors.border,
  },
});
