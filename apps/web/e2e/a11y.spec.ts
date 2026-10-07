import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fixtures } from "./support/backend";
import { login } from "./support/panel";

// WCAG 2.2 A/AA y las buenas prácticas de axe.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Corre axe sobre lo que se ve (con un diálogo abierto, axe revisa la página entera igual). */
async function expectNoViolations(page: Page): Promise<void> {
  // Que no queden esqueletos: axe tiene que ver los datos ya cargados.
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  // Y que terminen las transiciones (un diálogo a medio aparecer da falsos errores de contraste).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        // Si la animación se cancela (el elemento se desmontó), `finished` se rechaza: no importa.
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary}`),
  }));
  expect(summary).toEqual([]);
}

/** Abre un diálogo, lo revisa y lo cierra con Escape. */
async function expectAccessibleDialog(page: Page, opener: Locator, title: string | RegExp): Promise<Locator> {
  await opener.click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await expectNoViolations(page);
  return dialog;
}

async function closeDialog(page: Page, dialog: Locator): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name, exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}

test("login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Ingresá al panel" })).toBeVisible();
  await expectNoViolations(page);
});

test.describe("panel", () => {
  test.beforeEach(({ page }) => login(page));

  test("inicio", async ({ page }) => {
    await page.goto("/");
    await expectNoViolations(page);
  });

  test("reservas", async ({ page }) => {
    await page.goto("/reservations");
    await expectNoViolations(page);
    // Mañana están las reservas que confirmó el smoke.
    await page.getByRole("button", { name: "Día siguiente" }).click();
    const reservation = page.getByRole("button", { name: new RegExp(`${fixtures.member_name}.*10:00`) });
    await closeDialog(page, await expectAccessibleDialog(page, reservation, "Reserva"));
    const form = await expectAccessibleDialog(page, page.getByRole("button", { name: "Nueva reserva" }), "Nueva reserva");
    await form.getByRole("tab", { name: "Invitado" }).click();
    await expect(form.getByLabel("Nombre del invitado")).toBeVisible();
    await expectNoViolations(page);
    await closeDialog(page, form);
    await openTab(page, "Historial");
    await expectNoViolations(page);
  });

  test("socios", async ({ page }) => {
    await page.goto("/members");
    await expectNoViolations(page);
    await closeDialog(page, await expectAccessibleDialog(page, page.getByRole("button", { name: "Invitar socio" }), "Invitar socio"));
    for (const tab of ["Solicitudes", "Invitaciones"]) {
      await openTab(page, tab);
      await expectNoViolations(page);
    }
    await openTab(page, "Planes");
    await expectNoViolations(page);
    await closeDialog(page, await expectAccessibleDialog(page, page.getByRole("button", { name: "Nuevo plan" }), "Nuevo plan"));
  });

  test("caja", async ({ page }) => {
    await page.goto("/cash");
    await expectNoViolations(page);
    const opener = page.getByRole("button", { name: "Registrar movimiento" });
    const movement = await expectAccessibleDialog(page, opener, "Registrar movimiento");
    // El buscador de socios, ya con uno elegido.
    await movement.getByRole("searchbox", { name: "Socio (opcional)" }).fill(fixtures.member_name.split(" ")[1]);
    await movement.getByRole("list", { name: "Resultados" }).getByRole("button", { name: new RegExp(fixtures.member_name) }).click();
    await expect(movement.getByRole("group", { name: "Socio (opcional)" })).toContainText(fixtures.member_name);
    await expectNoViolations(page);
    await closeDialog(page, movement);
    const exportCsv = page.getByRole("button", { name: "Exportar CSV" });
    await closeDialog(page, await expectAccessibleDialog(page, exportCsv, "Exportar caja"));
    const voidPayment = page.getByRole("button", { name: /^Anular movimiento: / });
    await closeDialog(page, await expectAccessibleDialog(page, voidPayment, "Anular movimiento"));
  });

  test("cuotas", async ({ page }) => {
    await page.goto("/fees");
    await expect(page.getByRole("row", { name: new RegExp(fixtures.member_name) })).toContainText("Pagada");
    await expectNoViolations(page);
    const generate = page.getByRole("button", { name: "Generar cuotas del mes" });
    await closeDialog(page, await expectAccessibleDialog(page, generate, /^Generar cuotas de/));
  });

  test("stock", async ({ page }) => {
    await page.goto("/stock");
    await expectNoViolations(page);
    const itemForm = await expectAccessibleDialog(page, page.getByRole("button", { name: "Nuevo ítem" }), "Nuevo ítem");
    // Un ítem propio para llegar a los movimientos (el seed no trae stock).
    const name = `Pelotas ${Date.now()}`;
    await itemForm.getByLabel("Nombre").fill(name);
    await itemForm.getByLabel("Cantidad inicial").fill("10");
    await itemForm.getByRole("button", { name: "Crear ítem" }).click();
    await expect(itemForm).toBeHidden();
    await expectNoViolations(page);

    await page.getByRole("button", { name: `Acciones de ${name}` }).click();
    const move = page.getByRole("menuitem", { name: "Registrar movimiento" });
    const movement = await expectAccessibleDialog(page, move, "Registrar movimiento");
    await movement.getByRole("tab", { name: "Ajuste" }).click();
    await expect(movement.getByLabel("Cantidad real (contada)")).toBeVisible();
    await expectNoViolations(page);
    await closeDialog(page, movement);

    await page.getByRole("button", { name: `Acciones de ${name}` }).click();
    const history = page.getByRole("menuitem", { name: "Ver movimientos" });
    await closeDialog(page, await expectAccessibleDialog(page, history, "Movimientos"));
  });

  test("gastos", async ({ page }) => {
    await page.goto("/expenses");
    await expectNoViolations(page);
    await closeDialog(page, await expectAccessibleDialog(page, page.getByRole("button", { name: "Nuevo gasto" }), "Nuevo gasto"));
  });

  test("ajustes", async ({ page }) => {
    await page.goto("/settings");
    await expectNoViolations(page);
    const invite = page.getByRole("button", { name: "Invitar", exact: true });
    await closeDialog(page, await expectAccessibleDialog(page, invite, "Invitar al equipo"));
  });
});
