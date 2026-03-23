/**
 * Text — Primitiva tipográfica del Design System
 * =================================================
 * Invoca la fuente del sistema en cada plataforma:
 *   iOS     → SF Pro (fontFamily por defecto del SO — peso/tracking automático)
 *   Android → Roboto
 *   Web     → system-ui / -apple-system
 *
 * No requiere instalación de fuentes externas.
 * La consistencia viene de tamaños, pesos y letter-spacing normalizados.
 *
 * Variantes:
 *   display    → 32 / 800 / -0.8   Título hero de pantalla
 *   title      → 24 / 800 / -0.6   Cabecera principal de sección
 *   heading    → 17 / 700 / -0.3   Título de sub-sección
 *   subheading → 15 / 600 / -0.1   Nombre de cancha, campo de menú
 *   body       → 14 / 400 /  0     Párrafo / descripción
 *   caption    → 12 / 400 /  0.1   Fechas, metadatos
 *   label      → 11 / 600 /  0.2   Pills, tags, etiquetas de ícono
 *
 * Props extra:
 *   weight  — override de fontWeight ("300"–"800")
 *   color   — override de color
 *   muted   — atajo para Colors.textMuted
 */

import React from "react";
import {
  Text as RNText,
  TextProps,
  StyleSheet,
  TextStyle,
} from "react-native";

import { Colors } from "@/constants/Colors";

// ── Tipos ─────────────────────────────────────────────────────

export type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "caption"
  | "label";

interface AppTextProps extends TextProps {
  /** Variante tipográfica predefinida (default: "body") */
  variant?: TextVariant;
  /** Override de peso de fuente */
  weight?: TextStyle["fontWeight"];
  /** Override de color de texto */
  color?: string;
  /** Atajo semántico → Colors.textMuted */
  muted?: boolean;
}

// ── Estilos de variantes ──────────────────────────────────────
// No se especifica fontFamily → el SO usa SF Pro (iOS) / Roboto (Android)
// de forma automática, con soporte correcto para todos los pesos.

const v = StyleSheet.create({
  display: {
    fontSize:      32,
    fontWeight:    "800",
    letterSpacing: -0.8,
    color:         Colors.text,
  },
  title: {
    fontSize:      24,
    fontWeight:    "800",
    letterSpacing: -0.6,
    color:         Colors.text,
  },
  heading: {
    fontSize:      17,
    fontWeight:    "700",
    letterSpacing: -0.3,
    color:         Colors.text,
  },
  subheading: {
    fontSize:      15,
    fontWeight:    "600",
    letterSpacing: -0.1,
    color:         Colors.text,
  },
  body: {
    fontSize:      14,
    fontWeight:    "400",
    letterSpacing:  0,
    lineHeight:    21,
    color:         Colors.text,
  },
  caption: {
    fontSize:      12,
    fontWeight:    "400",
    letterSpacing:  0.1,
    color:         Colors.textMuted,
  },
  label: {
    fontSize:      11,
    fontWeight:    "600",
    letterSpacing:  0.2,
    color:         Colors.textMuted,
  },
});

// ── Componente ────────────────────────────────────────────────

export function Text({
  variant = "body",
  weight,
  color,
  muted,
  style,
  ...props
}: AppTextProps) {
  return (
    <RNText
      style={[
        v[variant],
        weight !== undefined ? { fontWeight: weight }     : null,
        muted                ? { color: Colors.textMuted } : null,
        color                ? { color }                   : null,
        style,
      ]}
      {...props}
    />
  );
}
