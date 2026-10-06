import { expect, test, type Locator } from "@playwright/test";

import { fixtures } from "./support/backend";

const member = fixtures.member_name;
const [firstCourt] = fixtures.courts;

/** El estado de una reserva en su diálogo de detalle. */
function reservationStatus(dialog: Locator): Locator {
  return dialog.locator("dt:text-is('Estado') + dd");
}

test("login, reserva, confirmación, cobro de cuota y caja", async ({ page }) => {
  await test.step("login", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(fixtures.owner_email);
    await page.getByLabel("Contraseña").fill(fixtures.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
  });

  const detail = page.getByRole("dialog", { name: "Reserva", exact: true });

  await test.step("crear una reserva para mañana", async () => {
    await page.getByRole("link", { name: "Reservas", exact: true }).click();
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByRole("button", { name: `Reservar ${firstCourt} a las 10:00` }).click();

    const form = page.getByRole("dialog", { name: "Nueva reserva" });
    await form.getByLabel("Socio").fill(member.split(" ")[1]);
    await form.getByRole("list", { name: "Resultados" }).getByRole("button", { name: new RegExp(member) }).click();
    await form.getByRole("button", { name: "Crear reserva" }).click();

    await expect(reservationStatus(detail)).toHaveText("Confirmada");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: new RegExp(`${member}.*10:00`) })).toBeVisible();
  });

  await test.step("confirmar la reserva pendiente que llegó desde la app", async () => {
    await page.getByRole("button", { name: new RegExp(`${member}.*${fixtures.pending_reservation_time}`) }).click();
    await expect(reservationStatus(detail)).toHaveText("Pendiente");
    await detail.getByRole("button", { name: "Confirmar" }).click();
    await expect(reservationStatus(detail)).toHaveText("Confirmada");
    await page.keyboard.press("Escape");
  });

  const feeRow = page.getByRole("row", { name: new RegExp(member) });

  await test.step("cobrar la cuota del mes", async () => {
    await page.getByRole("link", { name: "Cuotas", exact: true }).click();
    await expect(feeRow).toContainText("Pendiente");
    await feeRow.getByRole("button", { name: "Cobrar" }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar cuota" });
    await pay.getByRole("button", { name: "Cobrar", exact: true }).click();
    await expect(pay).toBeHidden();
    await expect(feeRow).toContainText("Pagada");
  });

  await test.step("ver el cobro en la caja de hoy", async () => {
    await page.getByRole("link", { name: "Caja", exact: true }).click();
    const movement = page.getByRole("row", { name: /Cuota/ });
    await expect(movement).toContainText(member);
    await expect(movement).toContainText("Efectivo");
    await expect(movement).toContainText(/\+\s*\$\s*15\.000/);
  });
});
