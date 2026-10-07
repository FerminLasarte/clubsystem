import { describe, expect, it } from "vitest";

import { courtDescription, reservationDay, statusLabel, timeRange } from "./format";

const AR = "America/Argentina/Buenos_Aires";

it("statusLabel usa las etiquetas compartidas", () => {
  expect(statusLabel("pending")).toBe("Pendiente");
  expect(statusLabel("cancelled")).toBe("Cancelada");
});

describe("día y horario en la zona del club", () => {
  // 22:30 a 00:00 del miércoles 7 en Argentina (en UTC ya es el jueves 8).
  const startsAt = "2026-10-08T01:30:00Z";
  const endsAt = "2026-10-08T03:00:00Z";

  it("reservationDay", () => {
    const club = { id: "club-1", name: "Club", logo_url: null, timezone: AR };
    expect(reservationDay({ starts_at: startsAt, club })).toBe("mié, 7 oct");
  });

  it("timeRange", () => {
    expect(timeRange(startsAt, endsAt, AR)).toBe("22:30 – 00:00");
  });
});

describe("courtDescription", () => {
  it("une deporte, superficie y si es techada", () => {
    expect(courtDescription({ sport: "padel", surface: "synthetic", is_indoor: true })).toBe(
      "Pádel · Sintético · Techada",
    );
  });

  it("omite lo que no aplica", () => {
    expect(courtDescription({ sport: "tennis", surface: null, is_indoor: false })).toBe("Tenis");
    expect(courtDescription({ sport: "football", surface: "grass", is_indoor: false })).toBe("Fútbol · Césped");
  });
});
