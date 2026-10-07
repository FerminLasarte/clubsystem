import { describe, expect, it } from "vitest";

import { addDays, BOOKING_DAYS, bookingDays } from "./dates";

describe("addDays", () => {
  it("cruza meses, años y bisiestos", () => {
    expect(addDays("2026-10-07", 1)).toBe("2026-10-08");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("bookingDays", () => {
  it("devuelve BOOKING_DAYS días seguidos desde hoy", () => {
    const days = bookingDays("2026-10-07");
    expect(days).toHaveLength(BOOKING_DAYS);
    expect(days[0].date).toBe("2026-10-07");
    expect(days.at(-1)?.date).toBe("2026-10-20");
  });

  it("los dos primeros son Hoy y Mañana; el resto, el día de la semana", () => {
    // 7 de octubre de 2026 es miércoles.
    expect(bookingDays("2026-10-07", 4)).toEqual([
      { date: "2026-10-07", label: "Hoy", detail: "7 oct" },
      { date: "2026-10-08", label: "Mañana", detail: "8 oct" },
      { date: "2026-10-09", label: "vie", detail: "9 oct" },
      { date: "2026-10-10", label: "sáb", detail: "10 oct" },
    ]);
  });
});
