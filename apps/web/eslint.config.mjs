import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Colores siempre con tokens semánticos (ver app/globals.css), nunca hex ni grises sueltos.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(^|\\s)(bg|text|border)-(gray|slate|zinc|neutral|stone)-\\d{2,3}/]",
          message: "Usá tokens semánticos (bg-muted, text-muted-foreground, border-border…).",
        },
        {
          selector: "Literal[value=/\\[#[0-9a-fA-F]{3,6}\\]/]",
          message: "Sin colores arbitrarios: agregá un token en app/globals.css.",
        },
      ],
    },
  },
  {
    // Componentes generados por shadcn: se actualizan con el CLI.
    files: ["components/ui/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
