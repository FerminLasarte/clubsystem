import { NextResponse, type NextRequest } from "next/server";

// Solo UX: si no hay indicio de sesión, manda a /login. La autorización real la hace
// el backend con las cookies HttpOnly en cada request.
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/verify-email", "/invitations"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (request.cookies.has("cs_has_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
