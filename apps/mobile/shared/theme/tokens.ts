/**
 * Única fuente de colores, espaciados, radios y tipografía de la app (regla `.ai/03`).
 * Ningún otro archivo define colores ni medidas sueltas.
 */

export const colors = {
  primary: "#0F172A",
  onPrimary: "#FFFFFF",
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  input: "#FFFFFF",
  subtle: "#F1F5F9",
  success: "#15803D",
  successSoft: "#DCFCE7",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  shadow: "#0F172A",
  transparent: "transparent",
} as const;

export type ColorToken = keyof typeof colors;

/** Tonos semánticos para estados (badges y avisos): fondo suave + texto. */
export const tones = {
  neutral: { background: "subtle", text: "muted" },
  success: { background: "successSoft", text: "success" },
  warning: { background: "warningSoft", text: "warning" },
  danger: { background: "dangerSoft", text: "danger" },
} as const satisfies Record<string, { background: ColorToken; text: ColorToken }>;

export type Tone = keyof typeof tones;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  small: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;

export type TypographyVariant = keyof typeof typography;

export const sizes = {
  hairline: 1,
  icon: 20,
  iconLg: 28,
  touch: 48,
  avatar: 56,
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.5,
} as const;

/** Elevación: solo sombra suave (sin bordes duros), según `.ai/03`. */
export const elevation = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
