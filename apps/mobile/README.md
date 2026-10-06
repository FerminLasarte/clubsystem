# ClubSystem — app del socio

Expo (SDK 57) + Expo Router + TanStack Query. Consume `/api/v1/auth/*`, `/api/v1/me` y `/api/v1/mobile/*`
a través del cliente compartido `@clubsystem/api`.

## Desarrollo

```bash
pnpm install                 # desde la raíz del monorepo
cd apps/mobile
npx expo start --ios         # simulador de iOS con Expo Go
```

La URL del backend sale de `EXPO_PUBLIC_API_URL` (ver `.env.example`). Sin definirla se usa
`http://localhost:8000`, que sirve en el simulador. En un celular físico creá `apps/mobile/.env.local` con
la IP de tu máquina en la red (`EXPO_PUBLIC_API_URL=http://<tu-ip>:8000`). En builds de release tiene que ser HTTPS.

## Calidad

```bash
pnpm --filter mobile type-check
pnpm --filter mobile lint
npx expo-doctor
```

## Estructura

- `app/`: solo rutas finas. `(auth)` y `(app)` se protegen con `Stack.Protected` en `app/_layout.tsx`.
- `features/<dominio>/{api.ts,hooks,components,lib}`: auth, clubs, booking, reservations, news, profile.
- `shared/api`: instancia del cliente HTTP (SecureStore, refresh rotativo, logout ante sesión vencida).
- `shared/ui`: componentes base (`Screen`, `Card`, `Button`, `Text`, `Input`, `StateView`).
- `shared/theme/tokens.ts`: única fuente de colores, espaciados, radios y tipografía.
