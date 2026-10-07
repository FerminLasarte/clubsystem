import { defineConfig } from "vitest/config";

export default defineConfig({
  // Alias `@/` desde los `paths` del tsconfig.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.test.ts"],
    // Zona del "dispositivo" distinta de UTC y de la del club, con offset negativo y horario de verano:
    // detecta días "YYYY-MM-DD" que se corren, cuentas con la zona del dispositivo y días sumados en hora local.
    env: { TZ: "America/New_York" },
  },
});
