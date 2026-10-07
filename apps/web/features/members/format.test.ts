import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { formatRelativeDay } from "./format";

const AR = "America/Argentina/Buenos_Aires";

beforeEach(() => {
  // 7 de octubre de 2026, 21:00 en Argentina (ya es 8 en UTC).
  vi.useFakeTimers({ now: new Date("2026-10-08T00:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

it("cuenta días de calendario en la zona del club", () => {
  expect(formatRelativeDay("2026-10-07T13:00:00Z", AR)).toBe("hoy");
  // 23:30 del 6 en Argentina, aunque en UTC ya sea el 7.
  expect(formatRelativeDay("2026-10-07T02:30:00Z", AR)).toBe("ayer");
  expect(formatRelativeDay("2026-10-08T15:00:00Z", AR)).toBe("mañana");
});

it("pasa a semanas, meses y años", () => {
  expect(formatRelativeDay("2026-10-01T15:00:00Z", AR)).toBe("hace 6 días");
  expect(formatRelativeDay("2026-09-23T15:00:00Z", AR)).toBe("hace 2 semanas");
  expect(formatRelativeDay("2026-07-01T15:00:00Z", AR)).toBe("hace 3 meses");
  expect(formatRelativeDay("2025-10-07T15:00:00Z", AR)).toBe("el año pasado");
  expect(formatRelativeDay("2023-10-07T15:00:00Z", AR)).toBe("hace 3 años");
});
