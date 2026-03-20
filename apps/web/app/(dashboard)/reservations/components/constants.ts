// apps/web/app/(dashboard)/reservations/components/constants.ts
// Constantes compartidas: slots de tiempo, colores, labels de estado.

export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
] as const;

/** Duración de cada celda de grilla en minutos. */
export const SLOT_GRID_DURATION = 30;

export const SPORT_LABELS: Record<string, string> = {
  tennis:     "Tenis",
  padel:      "Pádel",
  rugby:      "Rugby",
  football:   "Fútbol",
  basketball: "Básquet",
  hockey:     "Hockey",
  other:      "Otro",
};

export const SPORT_COLORS: Record<string, string> = {
  tennis:     "bg-yellow-100 text-yellow-700",
  padel:      "bg-blue-100 text-blue-700",
  rugby:      "bg-green-100 text-green-700",
  football:   "bg-emerald-100 text-emerald-700",
  basketball: "bg-orange-100 text-orange-700",
  hockey:     "bg-violet-100 text-violet-700",
  other:      "bg-gray-100 text-gray-600",
};

export const STATUS_CONFIG = {
  confirmed: {
    label:  "Confirmada",
    bg:     "bg-emerald-50",
    border: "border-emerald-200",
    text:   "text-emerald-700",
    dot:    "bg-emerald-500",
    badge:  "bg-emerald-100 text-emerald-700",
  },
  pending: {
    label:  "Pendiente",
    bg:     "bg-amber-50",
    border: "border-amber-200",
    text:   "text-amber-700",
    dot:    "bg-amber-400",
    badge:  "bg-amber-100 text-amber-700",
  },
  cancelled: {
    label:  "Cancelada",
    bg:     "bg-gray-50",
    border: "border-gray-200",
    text:   "text-gray-400",
    dot:    "bg-gray-300",
    badge:  "bg-gray-100 text-gray-500",
  },
  completed: {
    label:  "Completada",
    bg:     "bg-slate-50",
    border: "border-slate-200",
    text:   "text-slate-500",
    dot:    "bg-slate-400",
    badge:  "bg-slate-100 text-slate-600",
  },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;
