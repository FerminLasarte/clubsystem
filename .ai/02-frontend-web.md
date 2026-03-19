# Reglas de Desarrollo Web Frontend (Next.js & React)

## 1. Tipado Estricto

- Está ESTRICTAMENTE PROHIBIDO el uso de `any`.
- Define `interfaces` o `types` explícitos, descriptivos y exportables para todas las props, estados y respuestas de API.

## 2. Design System & UI (Tailwind CSS)

- Cero Hardcoding: Prohibido usar valores mágicos o colores quemados (ej. `bg-[#123456]`, `text-gray-900`).
- Variables Semánticas: Utiliza siempre las variables semánticas del tema (ej. `bg-background`, `text-muted-foreground`, `border-border`).
- Si introduces un color nuevo, indica que debe agregarse globalmente en `tailwind.config.ts`.
- Mantén un diseño minimalista, moderno y limpio (inspiración: Vercel, Stripe). Usa Lucide React para los íconos.

## 3. Responsividad Absoluta

- Diseño Mobile-First 100% fluido.
- Utiliza los modificadores de Tailwind (`sm:`, `md:`, `lg:`) para garantizar que la interfaz se adapte desde un celular hasta un monitor ultrawide.
- Prioriza el uso de Flexbox y CSS Grid para las estructuras principales.
