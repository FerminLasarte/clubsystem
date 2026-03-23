// apps/web/app/(dashboard)/settings/_components/types.ts

export const SETTINGS_TABS = [
  { id: "profile",       label: "Perfil",          icon: "User"        },
  { id: "club",          label: "Club",             icon: "Building2"   },
  { id: "payments",      label: "Pagos",            icon: "CreditCard"  },
  { id: "notifications", label: "Notificaciones",   icon: "Bell"        },
  { id: "staff",         label: "Equipo",           icon: "Users"       },
] as const;

export type TabId = typeof SETTINGS_TABS[number]["id"];

// ── Domain interfaces ─────────────────────────────────────────────────────────

export interface AdminProfile {
  fullName:  string;
  email:     string;
  avatarUrl: string;
}

export interface ClubData {
  name:                     string;
  phone:                    string;
  address:                  string;
  city:                     string;
  province:                 string;
  openTime:                 string;
  closeTime:                string;
  cancellationPolicyHours:  number;
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

// ── Estado inicial vacío — se reemplaza con datos reales de la API ─────────────

export const EMPTY_SETTINGS: SettingsState = {
  profile: {
    fullName:  "",
    email:     "",
    avatarUrl: "",
  },
  club: {
    name:                    "",
    phone:                   "",
    address:                 "",
    city:                    "",
    province:                "",
    openTime:                "",
    closeTime:               "",
    cancellationPolicyHours: 24,
  },
  payments: {
    requireDeposit:   false,
    mercadopagoToken: "",
  },
  notifications: {
    whatsappNewReservations: true,
    cancellationAlerts:      true,
    dailyCashReport:         false,
  },
};
