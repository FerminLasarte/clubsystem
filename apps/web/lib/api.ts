// apps/web/lib/api.ts
// Typed API client — wraps fetch with auth token injection and error handling

import type {
  Club,
  Court,
  Expense,
  StockItem,
  StockMovement,
  Reservation,
  User,
  PaginatedResponse,
  ApiError,
  LoginResponse,
} from "@clubsync/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token management (client-side only) ──────────────────────
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

// ── Base fetch wrapper ────────────────────────────────────────
class ApiClientError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = "Error inesperado";
    try {
      const err: ApiError = await res.json();
      detail = err.detail ?? detail;
    } catch {}

    // Auto-logout on 401
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login";
    }

    throw new ApiClientError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) return null as T;

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  /**
   * Login multi-club. Retorna token + club activo + todos los clubs del operador.
   */
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Cambia el club activo sin re-autenticar con contraseña.
   * Emite un nuevo JWT con el club_id y role del club destino.
   */
  switchClub: (clubId: string) =>
    request<LoginResponse>("/api/v1/auth/switch-club", {
      method: "POST",
      body: JSON.stringify({ club_id: clubId }),
    }),
};

// ── Club ──────────────────────────────────────────────────────
export const clubApi = {
  getCurrent: () => request<Club>("/api/v1/clubs/me"),
};

// ── Expenses ──────────────────────────────────────────────────
export const expensesApi = {
  list: (params?: {
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    hasAnomaly?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.category)    qs.set("category", params.category);
    if (params?.dateFrom)    qs.set("date_from", params.dateFrom);
    if (params?.dateTo)      qs.set("date_to", params.dateTo);
    if (params?.hasAnomaly !== undefined)
      qs.set("has_anomaly", String(params.hasAnomaly));
    if (params?.page)        qs.set("page", String(params.page));
    if (params?.pageSize)    qs.set("page_size", String(params.pageSize));

    return request<Expense[]>(`/api/v1/expenses?${qs}`);
  },

  create: (payload: Omit<Expense, "id" | "clubId" | "createdBy" | "createdAt">) =>
    request<Expense>("/api/v1/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  stats: (dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo)   qs.set("date_to", dateTo);
    return request<{
      total_amount: number;
      count: number;
      by_category: Record<string, number>;
      anomalies_pending_review: number;
    }>(`/api/v1/expenses/stats?${qs}`);
  },

  analyze: (expenseId: string) =>
    request(`/api/v1/expenses/${expenseId}/analyze`, { method: "POST" }),

  markReviewed: (expenseId: string) =>
    request(`/api/v1/expenses/${expenseId}/review`, { method: "PATCH" }),
};

// ── Stock ─────────────────────────────────────────────────────

/** Ítem de inventario tal como lo devuelve el backend (snake_case). */
export interface StockItemOut {
  id:           string;
  sku:          string | null;
  name:         string;
  category:     string | null;
  unit:         string;
  quantity:     number;
  min_quantity: number;
  unit_cost:    number | null;
  unit_price:   number | null;
  supplier:     string | null;
  is_active:    boolean;
  /** Calculado por el backend: quantity <= min_quantity */
  is_low_stock: boolean;
}

export interface StockItemCreate {
  name:          string;
  sku?:          string | null;
  category?:     string | null;
  unit?:         string;
  quantity?:     number;
  min_quantity?: number;
  unit_cost?:    number | null;
  unit_price?:   number | null;
  supplier?:     string | null;
}

export type StockItemUpdate = Partial<StockItemCreate>;

export interface StockStats {
  total_items:     number;
  low_stock_count: number;
  total_value:     number;
}

export interface MovementResult {
  quantity_before: number;
  quantity_after:  number;
}

export const stockApi = {
  list: (params?: { search?: string; category?: string; lowStock?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.search)                 qs.set("search",    params.search);
    if (params?.category)               qs.set("category",  params.category);
    if (params?.lowStock !== undefined) qs.set("low_stock", String(params.lowStock));
    return request<StockItemOut[]>(`/api/v1/stock?${qs}`);
  },

  stats: () => request<StockStats>("/api/v1/stock/stats"),

  create: (payload: StockItemCreate) =>
    request<StockItemOut>("/api/v1/stock", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: StockItemUpdate) =>
    request<StockItemOut>(`/api/v1/stock/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  movement: (
    itemId: string,
    payload: { type: "in" | "out" | "adjustment"; quantity_delta: number; reason?: string },
  ) =>
    request<MovementResult>(`/api/v1/stock/${itemId}/movements`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Ajuste auditado de cantidad (audit trail).
   * Usa POST /api/v1/stock/{itemId}/adjust.
   * quantity_change: siempre positivo; movement_type decide la dirección.
   */
  adjust: (
    itemId: string,
    payload: { quantity_change: number; movement_type: "IN" | "OUT"; notes?: string },
  ) =>
    request<MovementResult>(`/api/v1/stock/${itemId}/adjust`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    request<void>(`/api/v1/stock/${id}`, { method: "DELETE" }),
};

// ── Courts ────────────────────────────────────────────────────
export const courtsApi = {
  list: () => request<Court[]>("/api/v1/courts"),
};

// ── Reservations ──────────────────────────────────────────────
export const reservationsApi = {
  list: (params?: {
    date?: string;
    courtId?: string;
    status?: string;
    /** Si true, ignora target_date y devuelve todas las fechas (historial global). */
    allDates?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.date)                  qs.set("target_date", params.date);
    if (params?.courtId)               qs.set("court_id", params.courtId);
    if (params?.status)                qs.set("status", params.status);
    if (params?.allDates)              qs.set("all_dates", "true");
    return request<Reservation[]>(`/api/v1/reservations?${qs}`);
  },

  create: (payload: {
    court_id: string;
    user_id: string;
    starts_at: string;
    ends_at: string;
    total_price?: number;
    notes?: string;
  }) =>
    request<Reservation>("/api/v1/reservations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: { status?: string; paid_amount?: number; notes?: string }) =>
    request<Reservation>(`/api/v1/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /** Soft-cancel: sets status → 'cancelled' via DELETE. */
  cancel: (id: string) =>
    request<void>(`/api/v1/reservations/${id}`, { method: "DELETE" }),
};

// ── Staff ─────────────────────────────────────────────────────

export interface StaffMemberOut {
  id: string;
  email: string;
  /** Array de roles del operador en este club. Ej: ["OWNER"] o ["RESERVATIONS_MANAGER", "STOCK_MANAGER"] */
  roles: string[];
  status: "PENDING" | "ACTIVE";
  is_active: boolean;
  user_first_name: string | null;
  user_last_name:  string | null;
  created_at: string;  // ISO 8601
}

export interface InviteStaffPayload {
  email: string;
  /** Lista de roles a asignar. Solo RESERVATIONS_MANAGER y STOCK_MANAGER son invitables. */
  roles: string[];
}

export const staffApi = {
  list: (clubId: string) =>
    request<StaffMemberOut[]>(`/api/v1/clubs/${clubId}/staff`),

  invite: (clubId: string, payload: InviteStaffPayload) =>
    request<StaffMemberOut>(`/api/v1/clubs/${clubId}/staff/invite`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ── Dashboard ─────────────────────────────────────────────────

export interface RecentReservation {
  id: string;
  member_name: string;
  court_name: string;
  starts_at: string;   // "HH:MM"
  ends_at: string;     // "HH:MM"
  status: string;
  total_price: number;
}

/** Métricas mensuales para el dashboard — GET /api/v1/dashboard/kpis */
export interface DashboardKPIs {
  reservations_today: number;
  reservations_today_delta: number;
  reservations_this_month: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_delta_pct: number;
  active_members: number;
  new_members_this_month: number;
  expenses_this_month: number;
  anomalies_pending: number;
  recent_reservations: RecentReservation[];
}

/** Snapshot del día actual — GET /api/v1/dashboard/metrics */
export interface DashboardMetrics {
  /** Suma de paid_amount de reservas confirmadas hoy */
  total_revenue: number;
  /** Reservas de hoy en cualquier estado distinto de 'cancelled' */
  active_reservations: number;
  /** Canchas activas del club − las ocupadas en este momento */
  available_courts: number;
  /** Invitaciones de staff sin aceptar (status=PENDING) */
  pending_staff: number;
}

export const dashboardApi = {
  /** KPIs mensuales + lista de reservas recientes */
  kpis: () => request<DashboardKPIs>("/api/v1/dashboard/kpis"),
  /** Snapshot del día: ingresos, reservas, canchas disponibles, staff pendiente */
  metrics: () => request<DashboardMetrics>("/api/v1/dashboard/metrics"),
};

// ── Members ───────────────────────────────────────────────────

export interface MemberOut {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  dni: string | null;
  member_number: string | null;
  joined_at: string | null;   // YYYY-MM-DD
  is_active: boolean;
  // NOTE: no `role` field — users are global entities; roles only exist in ClubStaff
  last_login_at: string | null; // ISO 8601
}

export interface MembersResponse {
  items: MemberOut[];
  total: number;
  page: number;
  page_size: number;
}

export const membersApi = {
  list: (params?: { search?: string; isActive?: boolean; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search)             qs.set("search", params.search);
    if (params?.isActive !== undefined) qs.set("is_active", String(params.isActive));
    if (params?.page)               qs.set("page", String(params.page));
    if (params?.pageSize)           qs.set("page_size", String(params.pageSize));
    return request<MembersResponse>(`/api/v1/users?${qs}`);
  },

  stats: () => request<{ total: number; active: number; inactive: number }>("/api/v1/users/stats"),
};
