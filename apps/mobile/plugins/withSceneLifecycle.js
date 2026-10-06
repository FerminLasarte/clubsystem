// @ts-check
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

/**
 * Ciclo de vida por escenas (UIScene) en iOS, que el SDK de iOS 27 exige al abrir la app
 * (Apple TN3187). Expo lo adopta en el template del SDK 58; el runtime (`ExpoAppSceneDelegate`,
 * `ExpoReactNativeFactoryProvider`) ya viene en `expo` 57.0.26, y esto replica ese template:
 * - Info.plist: `UIApplicationSceneManifest` con `ExpoAppSceneDelegate` como delegate de la escena.
 * - AppDelegate: le da el factory al scene delegate y deja de crear la ventana, que ahora crea la escena.
 *
 * Temporal: al actualizar a Expo SDK 58 se borra este plugin (falla a propósito para que no quede).
 * Es JS porque Expo no transpila plugins locales en TypeScript.
 */
const MARKER = "ExpoReactNativeFactoryProvider";

const CLASS_DECLARATION = "class AppDelegate: ExpoAppDelegate {";

const START_IN_APP_DELEGATE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

`;

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withSceneLifecycle = (config) => {
  const sdkMajor = Number(config.sdkVersion?.split(".")[0]);
  if (sdkMajor >= 58) {
    throw new Error("Expo SDK 58 ya adopta UIScene: sacá plugins/withSceneLifecycle.js de app.config.ts.");
  }

  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            // Nombre Objective-C de `ExpoAppSceneDelegate` (paquete `expo`).
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    const source = mod.modResults.contents;
    // `expo prebuild` sin `--clean` vuelve a pasar por un AppDelegate ya modificado.
    if (source.includes(MARKER)) {
      return mod;
    }
    if (
      mod.modResults.language !== "swift" ||
      !source.includes(CLASS_DECLARATION) ||
      !source.includes(START_IN_APP_DELEGATE)
    ) {
      throw new Error("withSceneLifecycle: el AppDelegate no coincide con el template de Expo SDK 57.");
    }
    mod.modResults.contents = source
      .replace(CLASS_DECLARATION, `class AppDelegate: ExpoAppDelegate, ${MARKER} {`)
      .replace(
        START_IN_APP_DELEGATE,
        "    // La ventana la crea `ExpoAppSceneDelegate`, que arranca React Native en la escena (UIScene).\n",
      );
    return mod;
  });
};

module.exports = withSceneLifecycle;
