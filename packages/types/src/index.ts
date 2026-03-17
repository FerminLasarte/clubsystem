// packages/types/src/index.ts
// Shared types between web, mobile, and can be compared against FastAPI OpenAPI output

export type SportType = "tennis" | "padel" | "football" | "basketball" | "other";
export type UserRole = "admin" | "staff" | "member";
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
export interface User {
  id: string;
  clubId: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  memberNumber?: string;
  isActive: boolean;
  createdAt: string;
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
