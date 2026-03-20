// apps/web/app/(dashboard)/reservations/components/helpers.ts
// Funciones puras de utilidad: fechas, tiempos, solapamiento de slots.

import { SLOT_GRID_DURATION } from "./constants";
import type { Reservation }   from "./types";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function toDateString(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function isToday(d: Date): boolean {
  return toDateString(d) === toDateString(new Date());
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function durationMinutes(r: Reservation): number {
  return Math.round(
    (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000,
  );
}

/**
 * Detecta solapamiento real de rangos.
 * Una reserva de 90 min (08:00-09:30) aparece en los slots 08:00, 08:30 y 09:00.
 */
export function getReservationForSlot(
  reservations: Reservation[],
  courtId:      string,
  slot:         string,
): Reservation | undefined {
  const slotStart = timeToMinutes(slot);
  const slotEnd   = slotStart + SLOT_GRID_DURATION;

  return reservations.find((r) => {
    if (r.court_id !== courtId) return false;
    const resStart = timeToMinutes(toLocalTime(r.starts_at));
    const resEnd   = timeToMinutes(toLocalTime(r.ends_at));
    return resStart < slotEnd && resEnd > slotStart;
  });
}

export function buildSlotDate(date: Date, slot: string): Date {
  const [h, m] = slot.split(":").map(Number);
  const dt     = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}

export function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60 * 1000);
}
