// packages/types/src/index.ts
// Shared types between web, mobile, and can be compared against FastAPI OpenAPI output

export type SportType = "tennis" | "padel" | "football" | "basketball" | "other";

/**
 * @deprecated Los usuarios ya no tienen un rol global.
 * Los roles son contextuales y existen solo en ClubStaff.
 * Este tipo se mantiene para retrocompatibilidad con código legacy.
 */
export type UserRole = "admin" | "staff" | "member";

// ── RBAC — Staff roles (multi-tenant) ────────────────────────
/** Roles del panel de administración. Espejado en backend como staff_role enum. */
export type StaffRole =
  | "OWNER"                 // Acceso total al panel
  | "RESERVATIONS_MANAGER"  // Solo Reservas + Socios
  | "STOCK_MANAGER";        // Solo Inventario

/** Permisos por ruta de cada StaffRole. */
export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  OWNER:                ["/" , "/reservations", "/expenses", "/stock", "/members", "/settings"],
  RESERVATIONS_MANAGER: ["/", "/reservations", "/members"],
  STOCK_MANAGER:        ["/", "/stock"],
};

/** Labels en español para mostrar en UI. */
export const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER:                "Propietario",
  RESERVATIONS_MANAGER: "Gestor de Reservas",
  STOCK_MANAGER:        "Gestor de Stock",
};

/**
 * Representa un club al que el operador tiene acceso.
 * Retornado por el backend en LoginResponse.available_clubs.
 *
 * `roles` es un array — un operador puede tener múltiples roles en el mismo club.
 * Ej: roles=["RESERVATIONS_MANAGER", "STOCK_MANAGER"]
 */
export interface StaffClub {
  clubId:       string;
  clubName:     string;
  clubSlug:     string;
  roles:        StaffRole[];   // array — reemplaza el campo `role` singular
  primaryColor: string;
  accentColor:  string;
  logoUrl?:     string;
  fontFamily:   string;
}

/** Respuesta completa del endpoint de login. */
export interface LoginResponse {
  access_token: string;
  token_type:   string;
  club: {
    id:            string;
    slug:          string;
    name:          string;
    primary_color: string;
    accent_color:  string;
    logo_url?:     string;
    font_family:   string;
  };
  user_roles:      StaffRole[];   // array de roles en el club activo
  available_clubs: Array<{
    club_id:       string;
    club_name:     string;
    club_slug:     string;
    roles:         StaffRole[];   // array — reemplaza `role`
    primary_color: string;
    accent_color:  string;
    logo_url?:     string;
    font_family:   string;
  }>;
}
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type ExpenseCategory =
  | "maintenance"
  | "utilities"
  | "salaries"
  | "equipment"
  | "marketing"
  | "supplies"
  | "other";
export type AnomalySeverity = "low" | "medium" | "high" | "critical";
export type StockUnit = "unit" | "box" | "kg" | "liter" | "pack";

// ── Club ─────────────────────────────────────────────────────
export interface ClubTheme {
  logoUrl?: string;
  primaryColor: string;  // hex
  accentColor: string;   // hex
  fontFamily: string;
}

export interface Club {
  id: string;
  slug: string;
  name: string;
  sportTypes: SportType[];
  theme: ClubTheme;
  address?: string;
  city?: string;
  country: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  plan: "starter" | "pro" | "enterprise";
  createdAt: string;
}

// ── User ─────────────────────────────────────────────────────
/** Usuario global de la plataforma. Sin rol propio — los roles van en ClubStaff. */
export interface User {
  id:           string;
  clubId?:      string;   // deprecated: legacy para usuarios pre-RBAC
  email:        string;
  firstName:    string;
  lastName:     string;
  phone?:       string;
  avatarUrl?:   string;
  memberNumber?: string;
  isActive:     boolean;
  createdAt:    string;
}

// ── Court ─────────────────────────────────────────────────────
export interface Court {
  id: string;
  clubId: string;
  name: string;
  sport: SportType;
  surface?: string;
  isIndoor: boolean;
  isActive: boolean;
  capacity: number;
  hourlyRate: number;
  imageUrl?: string;
}

// ── Reservation ───────────────────────────────────────────────
export interface Reservation {
  id: string;
  clubId: string;
  courtId: string;
  userId: string;
  status: ReservationStatus;
  startsAt: string;  // ISO 8601
  endsAt: string;
  durationMin: number;
  totalPrice: number;
  paidAmount: number;
  isPaid: boolean;
  notes?: string;
  createdAt: string;
}

// ── Expense ───────────────────────────────────────────────────
export interface Expense {
  id: string;
  clubId: string;
  createdBy: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  expenseDate: string;   // YYYY-MM-DD
  receiptUrl?: string;
  vendorName?: string;
  vendorTaxId?: string;
  anomalyScore?: number;
  anomalySeverity?: AnomalySeverity;
  anomalyReason?: string;
  reviewedAt?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
}

// ── Stock ─────────────────────────────────────────────────────
export interface StockItem {
  id: string;
  clubId: string;
  sku?: string;
  name: string;
  category?: string;
  unit: StockUnit;
  quantity: number;
  minQuantity: number;
  unitCost?: number;
  unitPrice?: number;
  supplier?: string;
  isActive: boolean;
  isLowStock: boolean;  // derived: quantity <= minQuantity
  createdAt: string;
}

export interface StockMovement {
  id: string;
  clubId: string;
  itemId: string;
  performedBy: string;
  type: "in" | "out" | "adjustment";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  reason?: string;
  createdAt: string;
}

// ── API Responses ─────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  detail: string;
  code?: string;
}
