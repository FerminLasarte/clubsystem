import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@clubsystem/api", "@clubsystem/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Sin SENTRY_AUTH_TOKEN (desarrollo y CI) no sube source maps; sin NEXT_PUBLIC_SENTRY_DSN no manda
// nada (lib/monitoring.ts).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Los eventos del navegador van al mismo origen y Next los reenvía a Sentry: la CSP sigue con
  // connect-src 'self' y los bloqueadores de publicidad no los cortan. proxy.ts deja pasar esta ruta.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  silent: !process.env.CI,
  telemetry: false,
});
