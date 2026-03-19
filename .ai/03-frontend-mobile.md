# Reglas de Desarrollo Mobile (React Native & Expo)

## 1. Tipado Estricto

- Está ESTRICTAMENTE PROHIBIDO el uso de `any`.
- Define `interfaces` o `types` explícitos para todas las props, estados y respuestas de API.

## 2. UI y Estilos (Cero Hardcoding)

- Prohibido usar valores mágicos o quemados (ej. `padding: 15`, `color: '#123456'`).
- Utiliza un archivo centralizado de constantes para colores, tipografías y espaciados (ej. `constants/Colors.ts`).
- Mantén un diseño limpio, moderno y nativo.

## 3. Responsividad y UX Nativa

- Safe Area: Implementa SIEMPRE `useSafeAreaInsets` de `react-native-safe-area-context` para evitar superposiciones con el notch, la isla dinámica o las barras de navegación del sistema operativo.
- Scroll: Todo contenido que pueda exceder el tamaño de la pantalla verticalmente debe estar envuelto dentro de un `ScrollView` o utilizar un `FlatList` para listas dinámicas.
