/**
 * ClubSystem — Next.js Route Guard (proxy.ts)
 * ==========================================
 * Next.js 16+ usa "proxy" en lugar del deprecated "middleware".
 *
 * Protege todas las rutas del panel de administración.
 * Redirige a /login si no hay sesión activa (cookie `has_session`).
 *
 * ⚠️  Este guard es UX-only (client-side cookie, no HttpOnly).
 *     La seguridad real la garantiza el backend: todos los endpoints
 *     del panel requieren un JWT válido y devuelven 401/403 si no está presente.
 *
 * La cookie `has_session` se establece en login/page.tsx y se elimina en Sidebar.tsx.
 */

import { NextRequest, NextResponse } from "next/server";

// Rutas que no requieren autenticación
const PUBLIC_PATHS = ["/login", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar cookie de sesión
  const hasSession = request.cookies.has("has_session");

  if (!hasSession) {
    // Guardar la ruta destino para redirigir después del login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos)
     * - _next/image  (optimización de imágenes)
     * - favicon.ico
     * - Cualquier archivo con extensión (ej. .png, .svg)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf)).*)",
  ],
};
