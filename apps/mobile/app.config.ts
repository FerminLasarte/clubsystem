import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * URL del backend. Se define con `EXPO_PUBLIC_API_URL` (por ejemplo en `.env.local`).
 * El default solo sirve en desarrollo con el simulador; en un dispositivo físico usá la IP de tu máquina,
 * y en builds de release una URL HTTPS.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/** DSN de Sentry (shared/lib/monitoring.ts). Sin él, el monitoreo queda apagado (desarrollo y e2e). */
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/** `nativeBackground` de shared/theme/tokens.ts (la config nativa se evalúa fuera de Metro y no puede importarlo). */
const nativeBackground = "#F8FAFC";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ClubSystem",
  slug: "clubsystem",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "clubsystem",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "com.clubsystem.app",
    supportsTablet: true,
  },
  android: {
    package: "com.clubsystem.app",
    adaptiveIcon: {
      backgroundColor: nativeBackground,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: nativeBackground,
      },
    ],
    // Temporal hasta Expo SDK 58: sin UIScene la app se cierra al abrir con el SDK de iOS 27.
    "./plugins/withSceneLifecycle",
    // Sube source maps y símbolos en los builds de release con SENTRY_AUTH_TOKEN; sin él hay que
    // definir SENTRY_DISABLE_AUTO_UPLOAD=true (docs/deploy.md).
    ["@sentry/react-native", { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl,
    sentryDsn,
  },
});
