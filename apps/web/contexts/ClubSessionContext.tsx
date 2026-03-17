"use client";
// apps/web/contexts/ClubSessionContext.tsx
//
// Provee el estado de sesión multi-club a todo el panel de administración.
// Gestiona: club activo, rol activo, lista de clubs disponibles y el cambio de club.
//
// Uso:
//   const { activeClub, activeRole, availableClubs, switchClub } = useClubSession();

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StaffClub, StaffRole } from "@clubsync/types";
import { ROLE_PERMISSIONS } from "@clubsync/types";
import { authApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────
interface ClubSessionState {
  activeClub:     StaffClub | null;
  activeRole:     StaffRole | null;
  availableClubs: StaffClub[];
  userEmail:      string;
  isLoading:      boolean;
}

interface ClubSessionContextValue extends ClubSessionState {
  /** Cambia el club activo del operador emitiendo un nuevo JWT. */
  switchClub: (clubId: string) => Promise<void>;
  /** Re-hidrata el estado desde localStorage (útil tras cambios externos). */
  refreshSession: () => void;
  /** Devuelve true si el rol activo tiene permiso para la ruta dada. */
  canAccess: (path: string) => boolean;
}

// ── Context ───────────────────────────────────────────────────
const ClubSessionContext = createContext<ClubSessionContextValue | null>(null);


// ── Provider ──────────────────────────────────────────────────
export function ClubSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [state, setState] = useState<ClubSessionState>({
    activeClub:     null,
    activeRole:     null,
    availableClubs: [],
    userEmail:      "",
    isLoading:      true,
  });

  // ── Hidratar desde localStorage ───────────────────────────
  const loadFromStorage = useCallback(() => {
    const activeClubId = localStorage.getItem("club_id");
    const activeRole   = localStorage.getItem("user_role") as StaffRole | null;
    const email        = localStorage.getItem("user_email") ?? "";
    const rawClubs     = localStorage.getItem("available_clubs");

    let clubs: StaffClub[] = [];
    try {
      clubs = rawClubs ? (JSON.parse(rawClubs) as StaffClub[]) : [];
    } catch {
      clubs = [];
    }

    // Intentar encontrar el club activo en la lista
    let active: StaffClub | null =
      clubs.find((c) => c.clubId === activeClubId) ?? null;

    // Fallback: construir desde keys individuales si available_clubs está vacío
    if (!active && activeClubId && activeRole) {
      active = {
        clubId:       activeClubId,
        clubName:     localStorage.getItem("club_name") ?? "Club",
        clubSlug:     localStorage.getItem("club_slug") ?? "",
        role:         activeRole,
        primaryColor: localStorage.getItem("club_primary_color") ?? "#111827",
        accentColor:  localStorage.getItem("club_accent_color")  ?? "#3B82F6",
        logoUrl:      localStorage.getItem("club_logo_url") ?? undefined,
        fontFamily:   "Inter",
      };
      clubs = [active];
    }

    // Aplicar variables CSS de branding
    if (active) {
      document.documentElement.style.setProperty("--color-brand",      active.primaryColor);
      document.documentElement.style.setProperty("--color-accent-club", active.accentColor);
    }

    setState({
      activeClub:     active,
      activeRole:     active?.role ?? activeRole,
      availableClubs: clubs,
      userEmail:      email,
      isLoading:      false,
    });
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // ── Cambiar de club ────────────────────────────────────────
  const switchClub = useCallback(
    async (clubId: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const res = await authApi.switchClub(clubId);

        // Persistir nuevo token y datos del club
        localStorage.setItem("token",              res.access_token);
        localStorage.setItem("club_id",            res.club.id);
        localStorage.setItem("club_slug",          res.club.slug);
        localStorage.setItem("club_name",          res.club.name);
        localStorage.setItem("club_primary_color", res.club.primary_color);
        localStorage.setItem("club_accent_color",  res.club.accent_color);
        localStorage.setItem("user_role",          res.user_role);
        if (res.club.logo_url) {
          localStorage.setItem("club_logo_url", res.club.logo_url);
        }

        // Normalizar available_clubs de snake_case (API) → camelCase (frontend)
        const normalizedClubs: StaffClub[] = res.available_clubs.map((c) => ({
          clubId:       c.club_id,
          clubName:     c.club_name,
          clubSlug:     c.club_slug,
          role:         c.role,
          primaryColor: c.primary_color,
          accentColor:  c.accent_color,
          logoUrl:      c.logo_url,
          fontFamily:   c.font_family,
        }));
        localStorage.setItem("available_clubs", JSON.stringify(normalizedClubs));

        // Re-hidratar y redirigir al inicio del nuevo club
        loadFromStorage();
        router.push("/");
        router.refresh();
      } catch (err) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw err;
      }
    },
    [loadFromStorage, router]
  );

  // ── Helper de permisos ─────────────────────────────────────
  const canAccess = useCallback(
    (path: string): boolean => {
      if (!state.activeRole) return false;
      return ROLE_PERMISSIONS[state.activeRole]?.includes(path) ?? false;
    },
    [state.activeRole]
  );

  return (
    <ClubSessionContext.Provider
      value={{ ...state, switchClub, refreshSession: loadFromStorage, canAccess }}
    >
      {children}
    </ClubSessionContext.Provider>
  );
}


// ── Hook ──────────────────────────────────────────────────────
export function useClubSession(): ClubSessionContextValue {
  const ctx = useContext(ClubSessionContext);
  if (!ctx) {
    throw new Error(
      "useClubSession debe usarse dentro de <ClubSessionProvider>. " +
      "Asegurate de que el DashboardLayout envuelva a sus hijos con el provider."
    );
  }
  return ctx;
}
