import { expect, it } from "vitest";

import { isActive } from "./status";

it("solo las pendientes y confirmadas están activas", () => {
  expect(isActive("pending")).toBe(true);
  expect(isActive("confirmed")).toBe(true);
  expect(isActive("cancelled")).toBe(false);
  expect(isActive("completed")).toBe(false);
});
