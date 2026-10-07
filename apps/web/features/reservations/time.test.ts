import { describe, expect, it } from "vitest";

import { formatDuration, localParts, minutesToTime, timeToMinutes } from "./time";

describe("timeToMinutes", () => {
  it("acepta HH:MM y HH:MM:SS", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("23:59:00")).toBe(1439);
  });
});

describe("minutesToTime", () => {
  it("formatea minutos desde las 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(615)).toBe("10:15");
    expect(minutesToTime(24 * 60)).toBe("24:00");
  });

  it("recorta al día", () => {
    expect(minutesToTime(-30)).toBe("00:00");
    expect(minutesToTime(25 * 60)).toBe("24:00");
  });
});

it("formatDuration en horas y minutos", () => {
  expect(formatDuration(45)).toBe("45 min");
  expect(formatDuration(60)).toBe("1 h");
  expect(formatDuration(90)).toBe("1 h 30 min");
  expect(formatDuration(120)).toBe("2 h");
});

it("localParts da el día y la hora en la zona del club", () => {
  // 02:30 UTC del 8 = 23:30 del 7 en Argentina.
  expect(localParts("2026-10-08T02:30:00Z", "America/Argentina/Buenos_Aires")).toEqual({
    day: "2026-10-07",
    minutes: 23 * 60 + 30,
    time: "23:30",
  });
});
