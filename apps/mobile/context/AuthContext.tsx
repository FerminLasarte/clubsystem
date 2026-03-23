/**
 * AuthContext — Proveedor global de autenticación para ClubSystem Mobile.
 *
 * Responsabilidades:
 *  - Guardar el JWT de forma segura con expo-secure-store.
 *  - Restaurar la sesión automáticamente al abrir la app.
 *  - Exponer login(), register(), acceptInvitation() y logout().
 *  - Distinguir entre usuarios con club activo y usuarios en espera de invitación.
 *
 * Estados posibles del usuario:
 *   isLoading = true                  → restaurando sesión desde SecureStore
 *   token = null                      → no autenticado → pantalla de login
 *   token ≠ null, user.hasClub=false  → JWT limitado, esperando aceptar invitación
 *   token ≠ null, user.hasClub=true   → sesión completa → panel principal (tabs)
 */

import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { API_URL } from "@/config/api";

// ── Tipos ─────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  /** true cuando el usuario tiene un club activo asignado */
  hasClub: boolean;
  clubId: string | null;
  clubName: string | null;
  clubSlug: string | null;
  primaryColor: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** true mientras se restaura la sesión desde SecureStore al arrancar */
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<void>;
  /**
   * Acepta una invitación pendiente usando el staff_id del ClubStaff PENDING.
   * Reemplaza el JWT limitado con un token completo (con club_id y role).
   * Tras llamar a esta función, user.hasClub pasará a true.
   */
  acceptInvitation: (staffId: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Claves de SecureStore ──────────────────────────────────────

const STORE_TOKEN = "auth_token";
const STORE_USER  = "auth_user";

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
  });

  // Restaurar sesión guardada al arrancar la app
  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          SecureStore.getItemAsync(STORE_TOKEN),
          SecureStore.getItemAsync(STORE_USER),
        ]);

        if (token && userJson) {
          setState({ token, user: JSON.parse(userJson), isLoading: false });
        } else {
          setState({ token: null, user: null, isLoading: false });
        }
      } catch {
        setState({ token: null, user: null, isLoading: false });
      }
    })();
  }, []);

  // ── Helper: persistir sesión ──────────────────────────────────

  const _saveSession = useCallback(async (token: string, user: AuthUser) => {
    await Promise.all([
      SecureStore.setItemAsync(STORE_TOKEN, token),
      SecureStore.setItemAsync(STORE_USER, JSON.stringify(user)),
    ]);
    setState({ token, user, isLoading: false });
  }, []);

  // ── login ────────────────────────────────────────────────────
  // Usa el endpoint del Portal del Jugador (/mobile/auth/login).
  // Acepta email o DNI como identificador.

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await fetch(`${API_URL}/mobile/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail ?? "Email/DNI o contraseña incorrectos");
    }

    const data = await res.json();
    const member = data.member as {
      first_name: string;
      last_name: string;
      club_id: string | null;
      club_name: string | null;
    };

    const hasClub = member.club_id !== null && member.club_id !== undefined;

    const user: AuthUser = {
      email:        identifier.trim().toLowerCase(),
      firstName:    member.first_name,
      lastName:     member.last_name,
      role:         "member",
      hasClub,
      clubId:       hasClub ? member.club_id   : null,
      clubName:     hasClub ? member.club_name : null,
      clubSlug:     null,
      primaryColor: null,
    };

    await _saveSession(data.access_token, user);
  }, [_saveSession]);

  // ── register ─────────────────────────────────────────────────

  const register = useCallback(
    async (
      firstName: string,
      lastName: string,
      email: string,
      password: string,
    ) => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name:  lastName,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Error al registrarse");
      }
      // El register screen muestra éxito y el usuario inicia sesión manualmente.
    },
    []
  );

  // ── acceptInvitation ─────────────────────────────────────────

  const acceptInvitation = useCallback(
    async (staffId: string) => {
      const currentToken = state.token;
      if (!currentToken) throw new Error("No autenticado");

      const res = await fetch(`${API_URL}/invitations/${staffId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Error al aceptar la invitación");
      }

      const data = await res.json();

      const user: AuthUser = {
        email:        state.user?.email ?? "",
        firstName:    state.user?.firstName ?? "",
        lastName:     state.user?.lastName ?? "",
        role:         data.user_role,
        hasClub:      true,
        clubId:       data.club_id,
        clubName:     data.club_name,
        clubSlug:     data.club_slug,
        primaryColor: data.primary_color,
      };

      await _saveSession(data.access_token, user);
    },
    [state.token, state.user, _saveSession]
  );

  // ── logout ───────────────────────────────────────────────────

  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORE_TOKEN),
      SecureStore.deleteItemAsync(STORE_USER),
    ]);
    setState({ token: null, user: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, acceptInvitation, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
