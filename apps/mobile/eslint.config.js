// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const reactNative = require("eslint-plugin-react-native");

const HEX_COLOR = "/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/";
const MEASURES =
  "/^(margin|padding|gap|rowGap|columnGap|top|right|bottom|left|width|height|minWidth|minHeight|maxWidth|maxHeight|borderRadius|borderWidth|fontSize|lineHeight)/";

const noLiteralColors = {
  selector: `Literal[value=${HEX_COLOR}]`,
  message: "Colores solo desde shared/theme/tokens.ts.",
};
const noLiteralMeasures = {
  selector: `Property[key.name=${MEASURES}] > Literal[value>0]`,
  message: "Espaciados, radios y tamaños solo desde shared/theme/tokens.ts.",
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "expo-env.d.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "react-native": reactNative },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-native/no-color-literals": "error",
      "no-restricted-syntax": ["error", noLiteralColors, noLiteralMeasures],
      // HTTP solo a través del cliente compartido (shared/api/client.ts).
      "no-restricted-globals": ["error", { name: "fetch", message: "Usá `api` de shared/api/client.ts." }],
    },
  },
  {
    // Única fuente de tokens. app.config.ts se evalúa fuera de Metro y no puede importarlos.
    files: ["shared/theme/**", "app.config.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
