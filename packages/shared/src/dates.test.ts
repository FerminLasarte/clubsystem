import { afterEach, describe, expect, it, vi } from "vitest";

import {
  daysBetween,
  formatDay,
  isIsoDay,
  localDayOf,
  localTimeOf,
  monthLabel,
  shiftDay,
  todayIn,
  yearMonthOf,
  zonedToIso,
} from "./dates";

const AR = "America/Argentina/Buenos_Aires";
const NY = "America/New_York"; // Horario de verano 2026: del 8 de marzo al 1 de noviembre.

it("corre en una zona distinta de UTC y de la del club (vitest.config.ts)", () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
});

describe("días sin hora", () => {
  it("isIsoDay acepta solo días existentes con formato YYYY-MM-DD", () => {
    expect(isIsoDay("2026-10-07")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("2026-1-07")).toBe(false);
    expect(isIsoDay("2026-10-07T00:00:00Z")).toBe(false);
    expect(isIsoDay("")).toBe(false);
    expect(isIsoDay(null)).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });

  it("shiftDay cruza meses, años y bisiestos", () => {
    expect(shiftDay("2026-10-07", 1)).toBe("2026-10-08");
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-10-07", 0)).toBe("2026-10-07");
    // Cruza el cambio de horario de la zona del dispositivo (8 de marzo en Nueva York).
    expect(shiftDay("2026-03-07", 2)).toBe("2026-03-09");
  });

  it("daysBetween cuenta días de calendario, con signo", () => {
    expect(daysBetween("2026-10-07", "2026-10-07")).toBe(0);
    expect(daysBetween("2026-10-07", "2026-10-14")).toBe(7);
    expect(daysBetween("2026-10-14", "2026-10-07")).toBe(-7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    // Cruzar un cambio de horario en otras zonas no afecta: los días se calculan en UTC.
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("yearMonthOf separa año y mes (1-12)", () => {
    expect(yearMonthOf("2026-01-31")).toEqual({ year: 2026, month: 1 });
    expect(yearMonthOf("2026-12-01")).toEqual({ year: 2026, month: 12 });
  });

  it("formatDay no corre el día por la zona del dispositivo", () => {
    expect(formatDay("2026-10-07")).toBe("7 oct 2026");
    expect(formatDay("2026-01-01", { day: "numeric", month: "long" })).toBe("1 de enero");
  });

  it("monthLabel en largo y corto", () => {
    expect(monthLabel(2026, 10)).toBe("octubre de 2026");
    expect(monthLabel(2026, 1, true)).toBe("ene 2026");
  });
});

describe("instantes en la zona del club", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("localDayOf y localTimeOf usan la zona del club, no UTC ni la del dispositivo", () => {
    // 02:30 UTC del 8 = 23:30 del 7 en Argentina = 22:30 del 7 en Nueva York.
    expect(localDayOf("2026-10-08T02:30:00Z", AR)).toBe("2026-10-07");
    expect(localTimeOf("2026-10-08T02:30:00Z", AR)).toBe("23:30");
    expect(localDayOf("2026-10-07T23:30:00-03:00", AR)).toBe("2026-10-07");
  });

  it("la medianoche es 00:00 del día siguiente, no 24:00", () => {
    expect(localDayOf("2026-10-08T03:00:00Z", AR)).toBe("2026-10-08");
    expect(localTimeOf("2026-10-08T03:00:00Z", AR)).toBe("00:00");
  });

  it("todayIn depende de la zona pedida", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T02:30:00Z") });
    expect(todayIn(AR)).toBe("2026-10-07");
    expect(todayIn("UTC")).toBe("2026-10-08");
  });

  it("zonedToIso convierte la hora de pared a UTC", () => {
    expect(zonedToIso("2026-10-07", "18:00", AR)).toBe("2026-10-07T21:00:00.000Z");
    expect(zonedToIso("2026-10-07", "22:30", AR)).toBe("2026-10-08T01:30:00.000Z");
    expect(zonedToIso("2026-10-07", "00:00", AR)).toBe("2026-10-07T03:00:00.000Z");
  });

  it("zonedToIso respeta el horario de verano", () => {
    expect(zonedToIso("2026-03-07", "12:00", NY)).toBe("2026-03-07T17:00:00.000Z"); // EST, UTC-5
    expect(zonedToIso("2026-03-08", "12:00", NY)).toBe("2026-03-08T16:00:00.000Z"); // EDT, UTC-4
    // El día en que termina: 00:30 todavía es EDT y 12:00 ya es EST.
    expect(zonedToIso("2026-11-01", "00:30", NY)).toBe("2026-11-01T04:30:00.000Z");
    expect(zonedToIso("2026-11-01", "12:00", NY)).toBe("2026-11-01T17:00:00.000Z");
  });

  it("zonedToIso es la inversa de localDayOf + localTimeOf", () => {
    for (const [day, time, zone] of [
      ["2026-10-07", "23:30", AR],
      ["2026-06-15", "07:15", NY],
      ["2026-12-31", "23:59", "Asia/Kolkata"],
    ]) {
      const iso = zonedToIso(day, time, zone);
      expect(localDayOf(iso, zone)).toBe(day);
      expect(localTimeOf(iso, zone)).toBe(time);
    }
  });
});
