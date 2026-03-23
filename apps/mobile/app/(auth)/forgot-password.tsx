/**
 * Recuperar Contraseña — Portal del Jugador
 * ==========================================
 * Estructura visual idéntica al Login y Registro:
 * lienzo gris (#F7FAFC) + card blanca elevada.
 *
 * Seguridad: siempre se muestra la pantalla de éxito independientemente
 * de si el email existe en la DB (no revelamos información de cuentas).
 *
 * TODO backend: implementar POST /api/v1/auth/forgot-password
 *   Body:   { email: string }
 *   Acción: generar token de reset, enviar email con link de 1 uso.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { AuthInput } from "@/components/auth/AuthInput";
import { API_URL } from "@/config/api";

const C = Colors.light;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Ingresá tu email");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Siempre mostramos éxito — no revelar si el email existe (seguridad).
      setSent(true);
    } catch (e) {
      console.error("[ForgotPassword] error de red:", e);
      // Error de red: igualmente mostramos éxito para no bloquear al usuario.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de éxito ──────────────────────────────────────

  if (sent) {
    return (
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.decoCircleLg} pointerEvents="none" />

        <View style={styles.successContent}>
          {/* Ícono */}
          <View style={styles.successIconWrap}>
            <Feather name="mail" size={32} color={C.tint} />
          </View>

          <Text style={styles.successTitle}>Revisá tu email</Text>
          <Text style={styles.successSubtitle}>
            Si existe una cuenta con{" "}
            <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
            , recibirás un link para restablecer tu contraseña en los
            próximos minutos.
          </Text>
          <Text style={styles.spamHint}>
            Revisá la carpeta de spam si no lo encontrás.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Volver al inicio de sesión</Text>
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
          <Text style={styles.backText}>Volver al login</Text>
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
        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresá tu email y te enviaremos las instrucciones para
          restablecer tu contraseña.
        </Text>

        {/* ── Tarjeta de formulario ── */}
        <View style={styles.formCard}>
          <AuthInput
            label="Email"
            icon="mail"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

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
            onPress={handleSubmit}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Enviar instrucciones de recuperación"
          >
            {loading
              ? <ActivityIndicator color={C.textOnBrand} />
              : <Text style={styles.buttonText}>Enviar instrucciones</Text>
            }
          </Pressable>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya recordás tu contraseña?</Text>
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
    top:             -140,
    right:           -100,
    width:           300,
    height:          300,
    borderRadius:    150,
    backgroundColor: C.tintSubtle,
    pointerEvents:   "none",
  },
  decoCircleSm: {
    position:        "absolute",
    bottom:          40,
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
    flexDirection:   "row",
    alignItems:      "center",
    gap:             Spacing.xs,
    marginBottom:    Spacing.lg,
    alignSelf:       "flex-start",
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

  successContent: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    gap:               Spacing.md,
    paddingHorizontal: Spacing.lg,
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
    fontSize:  15,
    color:     C.textMuted,
    lineHeight: 23,
    textAlign: "center",
  },
  emailHighlight: {
    color:      C.text,
    fontWeight: "600",
  },
  spamHint: {
    fontSize:  13,
    color:     C.placeholder,
    textAlign: "center",
  },
});
