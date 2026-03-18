/**
 * AuthContext — Proveedor global de autenticación para ClubSync Mobile.
 *
 * Responsabilidades:
 *  - Guardar el JWT de forma segura con expo-secure-store.
 *  - Restaurar la sesión automáticamente al abrir la app.
 *  - Exponer login(), register() y logout() a todas las pantallas.
 *  - Exponer el usuario actual (email, nombre, rol, club).
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
  role: string;
  clubId: string;
  clubName: string;
  clubSlug: string;
  primaryColor: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** true mientras se restaura la sesión desde SecureStore al arrancar */
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<void>;
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

  // ── login ────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Email o contraseña incorrectos");
    }

    const data = await res.json();

    const user: AuthUser = {
      email,
      role: data.user_role,
      clubId: data.club.id,
      clubName: data.club.name,
      clubSlug: data.club.slug,
      primaryColor: data.club.primary_color,
    };

    await Promise.all([
      SecureStore.setItemAsync(STORE_TOKEN, data.access_token),
      SecureStore.setItemAsync(STORE_USER, JSON.stringify(user)),
    ]);

    setState({ token: data.access_token, user, isLoading: false });
  }, []);

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
          last_name: lastName,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al registrarse");
      }
      // El register screen muestra un estado de éxito y deja al usuario
      // iniciar sesión manualmente una vez que el admin lo asigne a un club.
    },
    []
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
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
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
