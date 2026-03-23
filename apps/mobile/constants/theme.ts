/**
 * Design tokens centralizados para ClubSystem Mobile.
 * Todos los colores de la app DEBEN venir de aquí — prohibido hardcodear valores.
 * Agregar nuevos colores aquí antes de usarlos en cualquier componente.
 */

import { Platform } from 'react-native';

// ── Paleta base ───────────────────────────────────────────────
/** Azul marino Slate-900 — color de acción principal (Stripe-like) */
const brand = '#0F172A';

export const Colors = {
  light: {
    // Texto
    text:           '#1A202C',
    textMuted:      '#718096',
    textOnBrand:    '#ffffff',

    // Fondos
    /** Blanco puro — cards, formularios */
    background:     '#ffffff',
    /** Gris ultra sutil — lienzo global de la app (slate-50) */
    surface:        '#F7FAFC',
    surfaceRaised:  '#EDF2F7',

    // Marca
    tint:           brand,
    tintPressed:    '#1E293B',
    tintSubtle:     'rgba(15, 23, 42, 0.07)',

    // Bordes
    /** Borde ultra fino, casi imperceptible (slate-100) */
    border:         '#EDF2F7',
    borderFocus:    brand,

    // Estado
    danger:         '#E53E3E',
    dangerSurface:  '#FFF5F5',
    success:        '#38A169',
    successSurface: '#F0FFF4',

    // Tabs / iconos
    icon:              '#718096',
    tabIconDefault:    '#718096',
    tabIconSelected:   brand,

    // Placeholder
    placeholder:    '#A0AEC0',
  },

  dark: {
    text:           '#ECEDEE',
    textMuted:      '#9BA1A6',
    textOnBrand:    '#ffffff',

    background:     '#151718',
    surface:        '#1E2021',
    surfaceRaised:  '#252829',

    tint:           '#ffffff',
    tintPressed:    '#E0E0E0',

    border:         '#2C3032',
    borderFocus:    '#ffffff',

    danger:         '#F87171',
    dangerSurface:  '#450A0A',
    success:        '#4ADE80',
    successSurface: '#052E16',

    icon:              '#9BA1A6',
    tabIconDefault:    '#9BA1A6',
    tabIconSelected:   '#ffffff',

    placeholder:    '#6B7280',
  },
};

// ── Tipografía ────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ── Espaciado ─────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ── Radios ────────────────────────────────────────────────────
export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};
