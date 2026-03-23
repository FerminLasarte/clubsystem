/**
 * Login — Portal del Jugador
 * ==========================
 * Bugfix: tras login exitoso se llama router.replace('/tabs') explícitamente.
 * No se delega la navegación al re-render de index.tsx para evitar el silencio
 * cuando el componente raíz no detecta el cambio de estado a tiempo.
 *
 * Jerarquía visual:
 *   Lienzo gris (#F7FAFC) → card blanca elevada → inputs + botón
 *   Links secundarios debajo de la card (fuera del área de acción principal)
 */

import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AuthInput } from "@/components/auth/AuthInput";

const C = Colors.light;

export default function LoginScreen() {
  const { login } = useAuth();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Completá todos los campos");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      // Bugfix: navegación explícita tras login exitoso.
      // router.replace evita apilar /tabs sobre el stack de auth.
      router.replace("/tabs");
    } catch (e: unknown) {
      console.error("[Login] handleLogin error:", e);
      setError(e instanceof Error ? e.message : "Email/DNI o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Círculos decorativos sobre el lienzo gris */}
      <View style={styles.decoCircleLg} pointerEvents="none" />
      <View style={styles.decoCircleSm} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop:    insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>CS</Text>
            </View>
          </View>
          <Text style={styles.appName}>ClubSystem</Text>
        </View>

        {/* ── Encabezado ── */}
        <Text style={styles.title}>Bienvenido de vuelta</Text>
        <Text style={styles.subtitle}>Ingresá con tu cuenta para continuar</Text>

        {/* ── Tarjeta de formulario ── */}
        <View style={styles.formCard}>
          <View style={styles.fields}>
            <AuthInput
              label="Email o DNI"
              icon="user"
              placeholder="tu@email.com o 12345678"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <AuthInput
              ref={passwordRef}
              label="Contraseña"
              icon="lock"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
          >
            {loading
              ? <ActivityIndicator color={C.textOnBrand} />
              : <Text style={styles.buttonText}>Iniciar sesión</Text>
            }
          </Pressable>
        </View>

        {/* ── Links secundarios (fuera de la card) ── */}
        <View style={styles.secondaryLinks}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable hitSlop={10}>
              <Text style={styles.secondaryLinkText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </Link>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tenés cuenta?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}> Registrarse</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.surface,
  },

  decoCircleLg: {
    position:        "absolute",
    top:             -140,
    right:           -100,
    width:           340,
    height:          340,
    borderRadius:    170,
    backgroundColor: C.tintSubtle,
    pointerEvents:   "none",
  },
  decoCircleSm: {
    position:        "absolute",
    bottom:          60,
    left:            -80,
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: C.tintSubtle,
    pointerEvents:   "none",
  },

  container: {
    flexGrow:          1,
    paddingHorizontal: Spacing.lg,
  },

  // Logo
  logoArea: {
    alignItems:   "center",
    marginBottom: Spacing.xl,
    gap:          Spacing.sm,
  },
  logoRing: {
    padding:         6,
    borderRadius:    Radius.xl + 6,
    borderWidth:     1,
    borderColor:     C.border,
    backgroundColor: C.background,
    ...Platform.select({
      ios: {
        shadowColor:   "#1A202C",
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius:  8,
      },
      android: { elevation: 2 },
    }),
  },
  logoMark: {
    width:           60,
    height:          60,
    borderRadius:    Radius.xl,
    backgroundColor: C.tint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoLetters: {
    color:         C.textOnBrand,
    fontSize:      22,
    fontWeight:    "800",
    letterSpacing: -0.5,
  },
  appName: {
    fontSize:      15,
    fontWeight:    "700",
    color:         C.textMuted,
    letterSpacing:  0.5,
  },

  // Encabezado
  title: {
    fontSize:      28,
    fontWeight:    "800",
    color:         C.text,
    letterSpacing: -0.6,
    marginBottom:  Spacing.xs,
  },
  subtitle: {
    fontSize:     15,
    color:        C.textMuted,
    lineHeight:   22,
    marginBottom: Spacing.lg,
  },

  // Tarjeta de formulario
  formCard: {
    backgroundColor: C.background,
    borderRadius:    20,
    padding:         Spacing.lg,
    gap:             Spacing.md,
    borderWidth:     1,
    borderColor:     C.border,
    ...Platform.select({
      ios: {
        shadowColor:   "#1A202C",
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius:  12,
      },
      android: { elevation: 2 },
    }),
  },
  fields: {
    gap: Spacing.md,
  },

  // Error
  errorBox: {
    backgroundColor: C.dangerSurface,
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   10,
    borderLeftWidth:   3,
    borderLeftColor:   C.danger,
  },
  errorText: {
    fontSize:   13,
    color:      C.danger,
    fontWeight: "500",
  },

  // Botón principal con colored shadow
  button: {
    height:          54,
    borderRadius:    Radius.md,
    backgroundColor: C.tint,
    alignItems:      "center",
    justifyContent:  "center",
    ...Platform.select({
      ios: {
        shadowColor:   C.tint,
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius:  10,
      },
      android: { elevation: 3 },
    }),
  },
  buttonPressed: {
    backgroundColor: C.tintPressed,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color:         C.textOnBrand,
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing:  0.2,
  },

  // Links secundarios debajo de la card
  secondaryLinks: {
    alignItems:  "center",
    marginTop:   Spacing.lg,
    marginBottom: Spacing.sm,
  },
  secondaryLinkText: {
    fontSize:   14,
    color:      C.tint,
    fontWeight: "500",
  },

  // Footer
  footer: {
    flexDirection:  "row",
    justifyContent: "center",
    alignItems:     "center",
    marginTop:      Spacing.sm,
  },
  footerText: {
    fontSize: 14,
    color:    C.textMuted,
  },
  footerLink: {
    fontSize:   14,
    color:      C.tint,
    fontWeight: "700",
  },
});
