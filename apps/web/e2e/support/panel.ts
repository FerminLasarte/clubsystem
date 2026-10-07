import { expect, type Page } from "@playwright/test";

import { fixtures } from "./backend";

/** Entra al panel con la dueña del club de prueba. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(fixtures.owner_email);
  await page.getByLabel("Contraseña").fill(fixtures.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
}
