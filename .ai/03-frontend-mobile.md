# Reglas de Desarrollo Mobile (React Native & Expo)

## 1. Tipado Estricto

- Está ESTRICTAMENTE PROHIBIDO el uso de `any`.
- Define `interfaces` o `types` explícitos para todas las props, estados y respuestas de API.

## 2. UI y Estilos (Cero Hardcoding)

- Prohibido usar valores mágicos o quemados (ej. `padding: 15`, `color: '#123456'`).
- Utiliza un archivo centralizado de constantes para colores, tipografías y espaciados (ej. `constants/Colors.ts`).
- Mantén un diseño limpio, moderno y nativo.

## 3. UI/UX y Design System (Estilo Premium / Stripe)
Nuestra aplicación busca una estética minimalista, elegante y elevada. Está ESTRICTAMENTE PROHIBIDO usar diseños planos genéricos o colores vibrantes/agresivos.

### 3.1. Paleta de Colores (Obligatoria)
- **Primary:** Azul Noche elegante (`#0F172A`). Usar en botones principales, íconos activos y headers importantes.
- **Background:** Gris ultra sutil (`#F8FAFC`). NUNCA usar blanco puro (`#FFFFFF`) como fondo global de la aplicación.
- **Card Background:** Blanco puro (`#FFFFFF`) para que resalte sobre el fondo gris.
- **Text:** Oscuro para títulos (`#1E293B`), Gris Muted (`#64748B`) para descripciones, fechas y textos secundarios.

### 3.2. Abstracción y Elevación (El Componente Card)
- **Regla DRY:** NUNCA construyas tarjetas desde cero con `View` y estilos sueltos.
- Debes utilizar SIEMPRE el componente abstracto `<Card />` importado de `@/components/Card` para envolver cualquier bloque de información (reservas, opciones de perfil, formularios).
- **Sombras:** La "elevación" se logra exclusivamente a través de las sombras sutiles configuradas dentro del componente `<Card />` (usando `shadowOpacity: 0.05` en iOS o `elevation: 2` muy suave en Android). No agregues bordes duros (`borderWidth`) a menos que sea un estado de error o un campo de texto (input).

### 3.3. Botones y Formularios
- Los botones principales deben ser sólidos, usando el color `Primary` y texto blanco, con esquinas redondeadas coincidentes con las tarjetas (ej. `borderRadius: 12` o `16`).
- Los inputs de formulario deben tener bordes muy finos (`#E2E8F0`) y un fondo ligeramente gris o blanco, manteniendo un padding interno generoso para facilitar el "tap" con el dedo.
