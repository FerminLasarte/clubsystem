import { NextResponse, type NextRequest } from "next/server";

// Solo UX: si no hay indicio de sesión, manda a /login. La autorización real la hace
// el backend con las cookies HttpOnly en cada request.
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/verify-email", "/invitations"];

// El navegador habla solo con el origen de la web: /api/* se reenvía al backend desde acá,
// así las cookies HttpOnly de sesión son de primera parte y no hace falta CORS.
// Se hace en el proxy (y no con rewrites de next.config) para mandarle al backend la IP real
// del usuario, que él no ve: la conexión le llega desde Vercel. El secreto compartido
// impide que alguien que llame directo a la API la falsifique (ver backend/app/api/rate_limit.py).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const CLIENT_IP_HEADER = "x-clubsystem-client-ip";
const PROXY_SECRET_HEADER = "x-clubsystem-proxy-secret";

function forwardToBackend(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  const secret = process.env.PROXY_SHARED_SECRET;
  // En Vercel, x-real-ip lo fija la plataforma (pisa lo que mande el cliente).
  const ip = request.headers.get("x-real-ip");
  if (secret && ip) {
    headers.set(CLIENT_IP_HEADER, ip);
    headers.set(PROXY_SECRET_HEADER, secret);
  }
  return NextResponse.rewrite(new URL(pathname + search, BACKEND_URL), { request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return forwardToBackend(request);
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (request.cookies.has("cs_has_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
