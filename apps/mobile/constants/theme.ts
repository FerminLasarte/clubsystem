/**
 * Design tokens centralizados para ClubSync Mobile.
 * Todos los colores de la app DEBEN venir de aquí — prohibido hardcodear valores.
 * Agregar nuevos colores aquí antes de usarlos en cualquier componente.
 */

import { Platform } from 'react-native';

// ── Paleta base ───────────────────────────────────────────────
const brand = '#0a7ea4';

export const Colors = {
  light: {
    // Texto
    text:           '#11181C',
    textMuted:      '#687076',
    textOnBrand:    '#ffffff',

    // Fondos
    background:     '#ffffff',
    surface:        '#F9FAFB',
    surfaceRaised:  '#F3F4F6',

    // Marca
    tint:           brand,
    tintPressed:    '#086d8e',
    tintSubtle:     'rgba(10, 126, 164, 0.07)',

    // Bordes
    border:         '#E5E7EB',
    borderFocus:    brand,

    // Estado
    danger:         '#EF4444',
    dangerSurface:  '#FEF2F2',
    success:        '#22C55E',
    successSurface: '#F0FDF4',

    // Tabs / iconos
    icon:              '#687076',
    tabIconDefault:    '#687076',
    tabIconSelected:   brand,

    // Placeholder
    placeholder:    '#9CA3AF',
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
