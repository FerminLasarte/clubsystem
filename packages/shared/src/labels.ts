/** Etiquetas en español de los enums de la API. Los colores los define cada app. */

export const STAFF_ROLE_LABELS = {
  OWNER: "Propietario",
  RESERVATIONS_MANAGER: "Gestor de reservas",
  STOCK_MANAGER: "Gestor de stock",
} as const;

export const SPORT_LABELS = {
  tennis: "Tenis",
  padel: "Pádel",
  football: "Fútbol",
  basketball: "Básquet",
  hockey: "Hockey",
  volleyball: "Vóley",
  rugby: "Rugby",
  other: "Otro",
} as const;

export const RESERVATION_STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
} as const;

export const MEMBERSHIP_STATUS_LABELS = {
  INVITED: "Invitado",
  PENDING: "Pendiente",
  APPROVED: "Activo",
  REJECTED: "Rechazado",
  INACTIVE: "Baja",
} as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
} as const;

export const FEE_STATUS_LABELS = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  CANCELLED: "Anulada",
} as const;

export const EXPENSE_CATEGORY_LABELS = {
  maintenance: "Mantenimiento",
  utilities: "Servicios",
  salaries: "Sueldos",
  equipment: "Equipamiento",
  marketing: "Marketing",
  supplies: "Insumos",
  other: "Otros",
} as const;

export const STOCK_UNIT_LABELS = {
  unit: "Unidad",
  box: "Caja",
  kg: "Kg",
  liter: "Litro",
  pack: "Pack",
} as const;
