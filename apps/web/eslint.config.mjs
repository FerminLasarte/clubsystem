import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  // eslint-config-next ya registra el plugin jsx-a11y con unas pocas reglas: sumamos las recomendadas.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Un <Label> que envuelve un Checkbox o Switch de Radix (un <button> con rol) sí lo nombra.
      "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["Checkbox", "Switch"] }],
    },
    // Sin este mapeo el plugin no revisa los componentes de components/ui.
    settings: {
      "jsx-a11y": {
        components: { Button: "button", Input: "input", Label: "label", Textarea: "textarea" },
      },
    },
  },
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
