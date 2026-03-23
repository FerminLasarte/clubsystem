"use client";
// apps/web/contexts/ClubSessionContext.tsx
//
// Provee el estado de sesión multi-club a todo el panel de administración.
//
// Cambios RBAC:
//   - `activeRole: StaffRole | null`  → `activeRoles: StaffRole[]`
//   - Un operador puede tener múltiples roles en el mismo club.
//   - `canAccess(path)` autoriza si al menos UNO de los roles activos
//     tiene permiso para la ruta.
//   - `hasRole(role)` permite comprobaciones puntuales en componentes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StaffClub, StaffRole } from "@ClubSystem/types";
import { ROLE_PERMISSIONS } from "@ClubSystem/types";
import { authApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────

interface ClubSessionState {
  activeClub:     StaffClub | null;
  /** Lista de roles del operador en el club activo. Ej: ["OWNER"] */
  activeRoles:    StaffRole[];
  availableClubs: StaffClub[];
  userEmail:      string;
  isLoading:      boolean;
}

interface ClubSessionContextValue extends ClubSessionState {
  switchClub:     (clubId: string) => Promise<void>;
  refreshSession: () => void;
  /** true si al menos un rol activo tiene permiso para la ruta. */
  canAccess:      (path: string) => boolean;
  /** true si el operador tiene exactamente este rol (entre sus roles activos). */
  hasRole:        (role: StaffRole) => boolean;
}

// ── Context ───────────────────────────────────────────────────

const ClubSessionContext = createContext<ClubSessionContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function ClubSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [state, setState] = useState<ClubSessionState>({
    activeClub:     null,
    activeRoles:    [],
    availableClubs: [],
    userEmail:      "",
    isLoading:      true,
  });

  // ── Hidratar desde localStorage ───────────────────────────

  const loadFromStorage = useCallback(() => {
    const activeClubId  = localStorage.getItem("club_id");
    const email         = localStorage.getItem("user_email") ?? "";
    const rawClubs      = localStorage.getItem("available_clubs");
    const rawRoles      = localStorage.getItem("user_roles");

    // Parsear roles del operador en el club activo (array JSON)
    let activeRoles: StaffRole[] = [];
    try {
      const parsed = rawRoles ? JSON.parse(rawRoles) : [];
      activeRoles = Array.isArray(parsed) ? parsed : [];
    } catch {
      activeRoles = [];
    }

    // Parsear lista de clubs disponibles
    let clubs: StaffClub[] = [];
    try {
      clubs = rawClubs ? (JSON.parse(rawClubs) as StaffClub[]) : [];
    } catch {
      clubs = [];
    }

    // Club activo: buscar en la lista por ID
    let active: StaffClub | null =
      clubs.find((c) => c.clubId === activeClubId) ?? null;

    // Fallback: construir desde keys individuales (retrocompat)
    if (!active && activeClubId && activeRoles.length > 0) {
      active = {
        clubId:       activeClubId,
        clubName:     localStorage.getItem("club_name")          ?? "Club",
        clubSlug:     localStorage.getItem("club_slug")          ?? "",
        roles:        activeRoles,
        primaryColor: localStorage.getItem("club_primary_color") ?? "#111827",
        accentColor:  localStorage.getItem("club_accent_color")  ?? "#3B82F6",
        logoUrl:      localStorage.getItem("club_logo_url")      ?? undefined,
        fontFamily:   "Inter",
      };
      clubs = [active];
    }

    // Aplicar variables CSS de branding
    if (active) {
      document.documentElement.style.setProperty("--color-brand",       active.primaryColor);
      document.documentElement.style.setProperty("--color-accent-club", active.accentColor);
    }

    setState({
      activeClub:     active,
      activeRoles:    active?.roles ?? activeRoles,
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

        localStorage.setItem("token",              res.access_token);
        localStorage.setItem("club_id",            res.club.id);
        localStorage.setItem("club_slug",          res.club.slug);
        localStorage.setItem("club_name",          res.club.name);
        localStorage.setItem("club_primary_color", res.club.primary_color);
        localStorage.setItem("club_accent_color",  res.club.accent_color);
        // Persistir roles como JSON array
        localStorage.setItem("user_roles",         JSON.stringify(res.user_roles ?? []));
        if (res.club.logo_url) {
          localStorage.setItem("club_logo_url", res.club.logo_url);
        }

        // Normalizar available_clubs: snake_case (API) → camelCase (frontend)
        const normalizedClubs: StaffClub[] = (res.available_clubs ?? []).map((c) => ({
          clubId:       c.club_id,
          clubName:     c.club_name,
          clubSlug:     c.club_slug,
          roles:        c.roles ?? [],
          primaryColor: c.primary_color,
          accentColor:  c.accent_color,
          logoUrl:      c.logo_url,
          fontFamily:   c.font_family,
        }));
        localStorage.setItem("available_clubs", JSON.stringify(normalizedClubs));

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

  // ── Helpers de permisos ────────────────────────────────────

  /**
   * Devuelve true si al menos UNO de los roles activos tiene permiso
   * para la ruta dada. Permite que un operador con múltiples roles
   * acceda a la unión de las rutas de todos sus roles.
   */
  const canAccess = useCallback(
    (path: string): boolean => {
      if (state.activeRoles.length === 0) return false;
      return state.activeRoles.some(
        (role) => ROLE_PERMISSIONS[role]?.includes(path) ?? false
      );
    },
    [state.activeRoles]
  );

  /** Comprueba si el operador tiene un rol específico entre sus roles activos. */
  const hasRole = useCallback(
    (role: StaffRole): boolean => state.activeRoles.includes(role),
    [state.activeRoles]
  );

  return (
    <ClubSessionContext.Provider
      value={{ ...state, switchClub, refreshSession: loadFromStorage, canAccess, hasRole }}
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
