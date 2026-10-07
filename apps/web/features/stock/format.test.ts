import { expect, it } from "vitest";

import { formatDelta } from "./format";

it("formatDelta muestra el signo explícito y la unidad", () => {
  expect(formatDelta("5", "unit")).toBe("+5 u.");
  expect(formatDelta("-2.500", "kg")).toBe("−2,5 kg");
  expect(formatDelta("0", "box")).toBe("0 cajas");
});
