"use client";
// apps/web/app/(auth)/login/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Credenciales inválidas");
      }

      const data = await res.json();
      const { access_token, club, user_roles, available_clubs } = data;

      // ── Persistir sesión en localStorage ──────────────────
      localStorage.setItem("token",              access_token);
      localStorage.setItem("club_id",            club.id);
      localStorage.setItem("club_slug",          club.slug);
      localStorage.setItem("club_name",          club.name);
      localStorage.setItem("club_primary_color", club.primary_color);
      localStorage.setItem("club_accent_color",  club.accent_color);
      localStorage.setItem("user_email",         email);
      // RBAC: roles activos como JSON array (multi-rol por operador)
      localStorage.setItem("user_roles", JSON.stringify(user_roles ?? []));

      // Normalizar available_clubs: snake_case (API) → camelCase (frontend)
      if (Array.isArray(available_clubs)) {
        const normalizedClubs = available_clubs.map((c: {
          club_id: string; club_name: string; club_slug: string; roles: string[];
          primary_color: string; accent_color: string; logo_url?: string; font_family: string;
        }) => ({
          clubId:       c.club_id,
          clubName:     c.club_name,
          clubSlug:     c.club_slug,
          roles:        c.roles ?? [],   // array de roles
          primaryColor: c.primary_color,
          accentColor:  c.accent_color,
          logoUrl:      c.logo_url,
          fontFamily:   c.font_family,
        }));
        localStorage.setItem("available_clubs", JSON.stringify(normalizedClubs));
      }

      // Cookie para el middleware de Next.js (guard de rutas del dashboard).
      // HttpOnly no es posible desde JS del cliente; la cookie sirve solo para
      // el guard de UX — la seguridad real la garantiza el backend (401/403).
      document.cookie = "has_session=1; path=/; max-age=86400; SameSite=Strict";

      // Aplicar variables CSS de branding
      document.documentElement.style.setProperty("--color-brand",       club.primary_color);
      document.documentElement.style.setProperty("--color-accent-club", club.accent_color);

      router.push("/");
    } catch (err: any) {
      setError(err.message ?? "Error al iniciar sesión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // overflow-hidden en el contenedor raíz evita el scroll y el blanco
    <div className="fixed inset-0 flex overflow-hidden">

      {/* Panel izquierdo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gray-900 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <span className="text-xs font-bold text-white">CS</span>
          </div>
          <span className="text-sm font-semibold text-white/80">ClubSync</span>
        </div>
        <div>
          <blockquote className="text-2xl font-light leading-snug text-white/90">
            "Gestión sin fricciones para que el club pueda enfocarse en el deporte."
          </blockquote>
          <p className="mt-4 text-sm text-white/40">— Panel de administración</p>
        </div>
        <div className="flex gap-6 text-xs text-white/30">
          <span>Reservas</span>
          <span>Gastos</span>
          <span>Stock</span>
          <span>Socios</span>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <span className="text-xs font-bold text-white">CS</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">ClubSync</span>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Ingresá con tu cuenta de administrador.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tuclub.com"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400"
              />
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />
                  }
                </button>
              </div>
              {/* Olvidaste tu contraseña — debajo del input */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {/* Error en español */}
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            ¿Problemas para acceder?{" "}
            <a href="mailto:soporte@clubsync.app" className="text-gray-600 hover:underline">
              Contactar soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
