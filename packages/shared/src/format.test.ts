import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatMoney, formatQuantity, formatTime, initials, pluralize } from "./format";

const AR = "America/Argentina/Buenos_Aires";
// Intl separa el símbolo y el número con un espacio duro.
const NBSP = " ";

describe("formatMoney", () => {
  it("formatea pesos argentinos desde el string decimal de la API", () => {
    expect(formatMoney("8000.00")).toBe(`$${NBSP}8.000`);
    expect(formatMoney("1234.5")).toBe(`$${NBSP}1.234,5`);
    expect(formatMoney("0.75")).toBe(`$${NBSP}0,75`);
    expect(formatMoney(1500)).toBe(`$${NBSP}1.500`);
    expect(formatMoney("-250")).toBe(`-$${NBSP}250`);
  });

  it("muestra una raya si no hay un monto válido", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("abc")).toBe("—");
  });
});

describe("formatQuantity", () => {
  it("formatea cantidades con hasta tres decimales y la unidad abreviada", () => {
    expect(formatQuantity("12.500")).toBe("12,5");
    expect(formatQuantity("1500")).toBe("1.500");
    expect(formatQuantity("0.1234")).toBe("0,123");
    expect(formatQuantity("12.500", "kg")).toBe("12,5 kg");
    expect(formatQuantity(3, "box")).toBe("3 cajas");
  });

  it("muestra una raya si la cantidad no es un número", () => {
    expect(formatQuantity("abc", "unit")).toBe("— u.");
  });
});

describe("fechas y horas de un instante", () => {
  // 02:30 UTC del 8 de octubre = 23:30 del 7 en Argentina.
  const lateNight = "2026-10-08T02:30:00Z";

  it("usan la zona del club", () => {
    expect(formatDate(lateNight, AR)).toBe("7 oct 2026");
    expect(formatDate(lateNight, "UTC")).toBe("8 oct 2026");
    expect(formatTime(lateNight, AR)).toBe("23:30");
    expect(formatDateTime(lateNight, AR)).toBe("7 oct 2026, 23:30");
  });

  it("formatDate acepta otras opciones de Intl", () => {
    expect(formatDate(lateNight, AR, { dateStyle: undefined, day: "numeric", month: "long" })).toBe("7 de octubre");
  });
});

describe("initials", () => {
  it("toma la inicial del nombre y del apellido en mayúscula", () => {
    expect(initials("ana", "pérez")).toBe("AP");
    expect(initials("Ana")).toBe("A");
    expect(initials(null, "Pérez")).toBe("P");
  });

  it("devuelve ? si no hay nombre", () => {
    expect(initials(null, null)).toBe("?");
    expect(initials("", undefined)).toBe("?");
  });
});

it("pluralize elige singular o plural", () => {
  expect(pluralize(1, "gasto", "gastos")).toBe("1 gasto");
  expect(pluralize(0, "gasto", "gastos")).toBe("0 gastos");
  expect(pluralize(3, "gasto", "gastos")).toBe("3 gastos");
});
