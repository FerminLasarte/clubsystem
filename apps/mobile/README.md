# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Correr en el celular con Expo Go

La forma más rápida de probar la app en tu dispositivo físico es usando **Expo Go**.

### Requisitos

- Tener [Expo Go](https://expo.dev/go) instalado en tu celular (disponible en App Store y Google Play).
- El celular y la computadora deben estar en la **misma red Wi-Fi**.

### Pasos

1. Desde la raíz del monorepo, instalar dependencias si no lo hiciste:

   ```bash
   pnpm install
   ```

2. Navegar a la app mobile e iniciar el servidor:

   ```bash
   cd apps/mobile
   npx expo start
   ```

   O desde la raíz usando turbo:

   ```bash
   pnpm dev
   ```

3. En la terminal aparecerá un **código QR**.

   - **Android**: abrí la app Expo Go y escaneá el QR desde la pantalla de inicio.
   - **iOS**: escaneá el QR con la cámara del iPhone (iOS 11+) y tocá la notificación que aparece.

4. La app se cargará directamente en tu celular. Cualquier cambio en el código se reflejará automáticamente gracias al hot reload.

### Troubleshooting

- Si el QR no conecta, probá presionar `w` en la terminal para obtener la URL y abrirla manualmente desde Expo Go.
- Si estás en una red con restricciones (oficina, universidad), usá el modo túnel: `npx expo start --tunnel` (requiere tener `@expo/ngrok` instalado).

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
