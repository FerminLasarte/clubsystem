/**
 * ClubSync — Sistema de color del Portal del Jugador
 * ====================================================
 * Fuente única de verdad para todos los valores de color.
 * Nunca usar literales hexadecimales fuera de este archivo.
 *
 * Filosofía de paleta (estética premium / Stripe):
 *   - primary:       azul marino Slate-900 → #0F172A  (botones, links, tint activo)
 *   - appBackground: gris ultra sutil       → #F7FAFC  (lienzo global)
 *   - cardBackground / background: blanco   → #FFFFFF  (cards, formularios)
 *   - textMuted:     slate-500              → #718096
 *   - border:        slate-100 ultra fino   → #EDF2F7
 *
 * Uso:
 *   import { Colors } from "@/constants/Colors";
 *   style={{ backgroundColor: Colors.appBackground, color: Colors.text }}
 */

export const Colors = {
  // ── Brand ──────────────────────────────────────────────────
  /** Azul marino Slate-900 — color de acción principal */
  primary:       "#0F172A",
  primaryDark:   "#1E293B",
  primarySubtle: "rgba(15, 23, 42, 0.07)",
  primaryBorder: "rgba(15, 23, 42, 0.18)",

  // ── Accent — Verde deportivo vibrante (Emerald-500) ────────
  /** Estado activo de pills, slots seleccionados y CTA de reserva */
  accent:        "#10B981",
  accentSubtle:  "rgba(16, 185, 129, 0.10)",
  accentBorder:  "rgba(16, 185, 129, 0.30)",

  // ── Backgrounds ────────────────────────────────────────────
  /** Lienzo global de la app — blanco puro (contraste via sombra en Cards) */
  appBackground:  "#FFFFFF",
  /** Superficie de cards, inputs y formularios — blanco puro */
  cardBackground: "#FFFFFF",
  /** Alias semántico de cardBackground (retrocompatibilidad) */
  background:     "#FFFFFF",
  /** Superficie secundaria para chips, pills y filas */
  surface:        "#F8FAFC",
  surfaceRaised:  "#EDF2F7",

  // ── Text ───────────────────────────────────────────────────
  /** Texto principal — negro cálido de alta legibilidad */
  text:        "#1A202C",
  /** Texto secundario / subtítulos / fechas — slate-500 */
  textMuted:   "#718096",
  textOnBrand: "#FFFFFF",
  placeholder: "#A0AEC0",

  // ── Borders ────────────────────────────────────────────────
  /** Borde ultra fino, casi imperceptible (slate-100) */
  border:      "#EDF2F7",
  /** Borde al enfocar un input */
  borderFocus: "#0F172A",

  // ── Sombra (para Card.tsx) ──────────────────────────────────
  shadow: "#1A202C",

  // ── Semantic ───────────────────────────────────────────────
  danger:         "#E53E3E",
  dangerSurface:  "#FFF5F5",
  success:        "#38A169",
  successSurface: "#F0FFF4",
  warning:        "#D69E2E",
  warningSurface: "#FFFFF0",

  // ── Reservation status ─────────────────────────────────────
  statusPending:   "#D69E2E",
  statusConfirmed: "#38A169",
  statusCompleted: "#718096",
} as const;

export type ColorKey = keyof typeof Colors;
