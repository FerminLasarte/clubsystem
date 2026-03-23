/**
 * Registro — Portal del Jugador
 * ==============================
 * Estructura visual idéntica al Login: lienzo gris + card blanca elevada.
 *
 * Campos: Nombre · Apellido · Email · Contraseña · Confirmar contraseña
 * (Nombre y Apellido en fila para optimizar espacio vertical en móvil.)
 *
 * Flujo post-registro:
 *   El backend crea el usuario global sin asignar club.
 *   Un admin del club debe invitarlo antes de poder iniciar sesión.
 *   → Se muestra una pantalla de éxito con este mensaje.
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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AuthInput } from "@/components/auth/AuthInput";

const C = Colors.light;

export default function RegisterScreen() {
  const { register } = useAuth();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();

  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  const lastNameRef   = useRef<TextInput>(null);
  const emailRef      = useRef<TextInput>(null);
  const passwordRef   = useRef<TextInput>(null);
  const confirmPwdRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Completá todos los campos");
      return;
    }
    if (password !== confirmPwd) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        password,
      );
      setSuccess(true);
    } catch (e: unknown) {
      console.error("[Register] error:", e);
      setError(e instanceof Error ? e.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de éxito ──────────────────────────────────────

  if (success) {
    return (
      <View
        style={[
          styles.root,
          styles.successRoot,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.decoCircleLg} pointerEvents="none" />

        <View style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <Feather name="check" size={32} color={C.tint} />
          </View>
          <Text style={styles.successTitle}>¡Cuenta creada!</Text>
          <Text style={styles.successSubtitle}>
            Tu cuenta fue registrada exitosamente.{"\n\n"}
            Un administrador del club deberá enviarte una invitación
            antes de que puedas iniciar sesión.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Ir a iniciar sesión</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Formulario ─────────────────────────────────────────────

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
            paddingTop:    insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Botón volver ── */}
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={C.tint} />
          <Text style={styles.backText}>Iniciar sesión</Text>
        </Pressable>

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
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Completá tus datos para comenzar</Text>

        {/* ── Tarjeta de formulario ── */}
        <View style={styles.formCard}>
          <View style={styles.fields}>
            {/* Nombre + Apellido en fila */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <AuthInput
                  label="Nombre"
                  icon="user"
                  placeholder="Juan"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={styles.nameField}>
                <AuthInput
                  ref={lastNameRef}
                  label="Apellido"
                  icon="user"
                  placeholder="García"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <AuthInput
              ref={emailRef}
              label="Email"
              icon="mail"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
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
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmPwdRef.current?.focus()}
            />

            <AuthInput
              ref={confirmPwdRef}
              label="Confirmar contraseña"
              icon="lock"
              placeholder="Repetí tu contraseña"
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
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
              pressed  && styles.buttonPressed,
              loading  && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta"
          >
            {loading
              ? <ActivityIndicator color={C.textOnBrand} />
              : <Text style={styles.buttonText}>Crear cuenta</Text>
            }
          </Pressable>

          <Text style={styles.terms}>
            Al registrarte aceptás los{" "}
            <Text style={styles.termsLink}>Términos de uso</Text>
            {" "}y la{" "}
            <Text style={styles.termsLink}>Política de privacidad</Text>.
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tenés cuenta?</Text>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.footerLink}> Iniciar sesión</Text>
          </Pressable>
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

  // Decoración
  decoCircleLg: {
    position:        "absolute",
    top:             -120,
    right:           -80,
    width:           300,
    height:          300,
    borderRadius:    150,
    backgroundColor: C.tintSubtle,
    pointerEvents:   "none",
  },
  decoCircleSm: {
    position:        "absolute",
    bottom:          60,
    left:            -60,
    width:           180,
    height:          180,
    borderRadius:    90,
    backgroundColor: C.tintSubtle,
    pointerEvents:   "none",
  },

  container: {
    flexGrow:          1,
    paddingHorizontal: Spacing.lg,
  },

  // Botón volver
  backBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            Spacing.xs,
    marginBottom:   Spacing.lg,
    alignSelf:      "flex-start",
    paddingVertical: Spacing.xs,
  },
  backText: {
    fontSize:   15,
    color:      C.tint,
    fontWeight: "500",
  },

  // Logo
  logoArea: {
    alignItems:   "center",
    marginBottom: Spacing.lg,
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
    width:           56,
    height:          56,
    borderRadius:    Radius.xl,
    backgroundColor: C.tint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoLetters: {
    color:         C.textOnBrand,
    fontSize:      20,
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

  // Tarjeta de formulario — idéntica al Login
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
  nameRow: {
    flexDirection: "row",
    gap:           Spacing.sm,
  },
  nameField: {
    flex: 1,
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

  // Botón principal — idéntico al Login
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

  // Términos
  terms: {
    fontSize:   12,
    color:      C.textMuted,
    textAlign:  "center",
    lineHeight: 18,
  },
  termsLink: {
    color:      C.tint,
    fontWeight: "500",
  },

  // Footer
  footer: {
    flexDirection:  "row",
    justifyContent: "center",
    alignItems:     "center",
    marginTop:      Spacing.lg,
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

  // ── Pantalla de éxito ──────────────────────────────────────

  successRoot: {
    paddingHorizontal: Spacing.lg,
  },
  successContent: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            Spacing.md,
  },
  successIconWrap: {
    width:           80,
    height:          80,
    borderRadius:    Radius.full,
    backgroundColor: C.tintSubtle,
    borderWidth:     1.5,
    borderColor:     C.border,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    Spacing.sm,
  },
  successTitle: {
    fontSize:      28,
    fontWeight:    "800",
    color:         C.text,
    letterSpacing: -0.5,
    textAlign:     "center",
  },
  successSubtitle: {
    fontSize:          15,
    color:             C.textMuted,
    lineHeight:        23,
    textAlign:         "center",
    paddingHorizontal: Spacing.md,
  },
});
