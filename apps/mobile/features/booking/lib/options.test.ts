import type { MemberCourtOut, Sport } from "@clubsystem/api";
import { describe, expect, it } from "vitest";

import { durationLabel, sportsOf } from "./options";

function court(id: string, sport: Sport): MemberCourtOut {
  return {
    id,
    name: id,
    sport,
    surface: null,
    is_indoor: false,
    capacity: 4,
    description: null,
    image_url: null,
    price_per_hour: "8000.00",
  };
}

it("durationLabel en horas y minutos", () => {
  expect(durationLabel(60)).toBe("1 h");
  expect(durationLabel(90)).toBe("1 h 30");
  expect(durationLabel(120)).toBe("2 h");
});

describe("sportsOf", () => {
  it("devuelve cada deporte una vez, en el orden de las canchas", () => {
    const courts = [court("c1", "padel"), court("c2", "tennis"), court("c3", "padel")];
    expect(sportsOf(courts)).toEqual(["padel", "tennis"]);
  });

  it("sin canchas no hay deportes", () => {
    expect(sportsOf([])).toEqual([]);
    expect(sportsOf(undefined)).toEqual([]);
  });
});
