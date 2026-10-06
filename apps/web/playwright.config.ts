import { defineConfig, devices } from "@playwright/test";

import { API_PORT, e2eCommand, WEB_PORT } from "./e2e/support/backend";

// E2E de humo del panel contra la API real y la base de test (ver docs/e2e.md).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Los tests comparten la base: corren de a uno y en orden.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: e2eCommand("serve", "--port", String(API_PORT)),
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Sirve el build de producción: `pnpm --filter web test:e2e` lo genera antes.
      command: `pnpm exec next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      env: { BACKEND_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
