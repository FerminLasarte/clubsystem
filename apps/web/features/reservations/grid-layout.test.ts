import type { GridCourtOut, ReservationGridOut, ReservationOut } from "@clubsystem/api";
import { describe, expect, it } from "vitest";

import { gridLayout } from "./grid-layout";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano.

/** Reserva entre dos horas de pared de Argentina ("YYYY-MM-DDTHH:MM"). */
function reservation(id: string, start: string, end: string): ReservationOut {
  return {
    id,
    court_id: "court-1",
    court_name: "Cancha 1",
    starts_at: `${start}:00-03:00`,
    ends_at: `${end}:00-03:00`,
    duration_minutes: 0,
    status: "confirmed",
    source: "PANEL",
    customer_type: "GUEST",
    customer_name: "Ana",
    customer_phone: null,
    member_number: null,
    membership_id: null,
    user_id: null,
    notes: null,
    total_price: "0",
    paid_amount: "0",
    cancel_reason: null,
    cancelled_at: null,
    confirmed_at: null,
    created_at: "2026-10-01T12:00:00Z",
  };
}

function court(id: string, reservations: ReservationOut[] = []): GridCourtOut {
  return { id, name: id, sport: "padel", surface: null, is_indoor: false, is_active: true, reservations };
}

function grid(overrides: Partial<ReservationGridOut>): ReservationGridOut {
  return {
    date: "2026-10-07",
    timezone: TZ,
    open_time: "08:00:00",
    close_time: "23:00:00",
    slot_minutes: 60,
    courts: [],
    ...overrides,
  };
}

describe("gridLayout", () => {
  it("arma una fila por franja dentro del horario del club", () => {
    const layout = gridLayout(grid({ open_time: "08:00:00", close_time: "12:00:00", slot_minutes: 30 }));
    expect(layout.rows).toEqual([480, 510, 540, 570, 600, 630, 660, 690]);
    expect(layout.first).toBe(480);
    expect(layout.slot).toBe(30);
  });

  it("sin horario, la grilla cubre el día entero", () => {
    const layout = gridLayout(grid({ open_time: null, close_time: null }));
    expect(layout.rows).toHaveLength(24);
    expect(layout.rows[0]).toBe(0);
    expect(layout.rows.at(-1)).toBe(23 * 60);
  });

  it("ubica cada reserva en minutos del día local del club, agrupada por cancha", () => {
    const r1 = reservation("r1", "2026-10-07T18:00", "2026-10-07T19:30");
    const r2 = reservation("r2", "2026-10-07T22:00", "2026-10-07T23:00");
    const layout = gridLayout(grid({ courts: [court("c1", [r1, r2]), court("c2")] }));
    expect(layout.blocks.get("c1")).toEqual([
      { reservation: r1, start: 18 * 60, end: 19 * 60 + 30 },
      { reservation: r2, start: 22 * 60, end: 23 * 60 },
    ]);
    expect(layout.blocks.get("c2")).toEqual([]);
  });

  it("extiende la grilla, redondeada a la franja, si una reserva queda fuera del horario", () => {
    const early = reservation("r1", "2026-10-07T06:30", "2026-10-07T07:30");
    const late = reservation("r2", "2026-10-07T23:00", "2026-10-07T23:45");
    const layout = gridLayout(grid({ courts: [court("c1", [early, late])] }));
    expect(layout.first).toBe(6 * 60);
    expect(layout.rows[0]).toBe(6 * 60);
    expect(layout.rows.at(-1)).toBe(23 * 60);
  });

  it("recorta las reservas que cruzan la medianoche", () => {
    const fromYesterday = reservation("r1", "2026-10-06T23:00", "2026-10-07T01:00");
    const intoTomorrow = reservation("r2", "2026-10-07T23:00", "2026-10-08T00:30");
    const layout = gridLayout(grid({ courts: [court("c1", [fromYesterday, intoTomorrow])] }));
    const [first, second] = layout.blocks.get("c1") ?? [];
    expect(first).toMatchObject({ start: 0, end: 60 });
    expect(second).toMatchObject({ start: 23 * 60, end: 24 * 60 });
    expect(layout.rows[0]).toBe(0);
    expect(layout.rows.at(-1)).toBe(23 * 60);
  });
});
