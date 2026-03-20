// apps/web/app/(dashboard)/reservations/components/types.ts
// Tipos compartidos por todos los subcomponentes del módulo de Reservas.

export interface Court {
  id:          string;
  name:        string;
  sport:       string;
  surface:     string | null;
  is_indoor:   boolean;
  hourly_rate: number;
}

export interface Reservation {
  id:          string;
  court_id:    string;
  court_name:  string;
  user_id:     string;
  user_name:   string;
  status:      "pending" | "confirmed" | "cancelled" | "completed";
  starts_at:   string;
  ends_at:     string;
  total_price: number;
  paid_amount: number;
  notes:       string | null;
}

export interface MemberUser {
  id:            string;
  first_name:    string;
  last_name:     string;
  member_number: string | null;
}

export interface SelectedSlot {
  courtId:    string;
  courtName:  string;
  courtSport: string;
  slot:       string;
  hourlyRate: number;
}

export const SLOT_DURATION_OPTIONS = [60, 90, 120] as const;
export type  SlotDuration = typeof SLOT_DURATION_OPTIONS[number];
