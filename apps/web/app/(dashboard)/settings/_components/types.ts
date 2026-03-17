// apps/web/app/(dashboard)/settings/_components/types.ts

export const SETTINGS_TABS = [
  { id: "profile",       label: "Perfil",          icon: "User"        },
  { id: "club",          label: "Club",             icon: "Building2"   },
  { id: "payments",      label: "Pagos",            icon: "CreditCard"  },
  { id: "notifications", label: "Notificaciones",   icon: "Bell"        },
] as const;

export type TabId = typeof SETTINGS_TABS[number]["id"];

// ── Domain interfaces ─────────────────────────────────────────────────────────

export interface AdminProfile {
  fullName:  string;
  email:     string;
  avatarUrl: string;
}

export interface ClubData {
  name:      string;
  phone:     string;
  address:   string;
  city:      string;
  province:  string;
  openTime:  string;
  closeTime: string;
}

export interface PaymentSettings {
  requireDeposit:    boolean;
  mercadopagoToken:  string;
}

export interface NotificationSettings {
  whatsappNewReservations: boolean;
  cancellationAlerts:      boolean;
  dailyCashReport:         boolean;
}

export interface SettingsState {
  profile:       AdminProfile;
  club:          ClubData;
  payments:      PaymentSettings;
  notifications: NotificationSettings;
}

// ── Mock initial data (replace with API call) ─────────────────────────────────

export const MOCK_SETTINGS: SettingsState = {
  profile: {
    fullName:  "Martín González",
    email:     "admin@clubtenistrandil.com",
    avatarUrl: "",
  },
  club: {
    name:      "Club de Tenis Tandil",
    phone:     "+54 249 442-1234",
    address:   "Av. del Valle 1200",
    city:      "Tandil",
    province:  "Buenos Aires",
    openTime:  "07:00",
    closeTime: "23:00",
  },
  payments: {
    requireDeposit:   true,
    mercadopagoToken: "APP_USR-1234567890abcdef-mock",
  },
  notifications: {
    whatsappNewReservations: true,
    cancellationAlerts:      true,
    dailyCashReport:         false,
  },
};
