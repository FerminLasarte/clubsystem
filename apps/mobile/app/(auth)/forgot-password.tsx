/**
 * Pantalla de recuperación de contraseña.
 *
 * Flujo:
 *  1. Usuario ingresa su email.
 *  2. Se llama a POST /auth/forgot-password (pendiente de implementar en backend).
 *  3. Independientemente del resultado, se muestra la pantalla de éxito
 *     (buena práctica de seguridad: no revelar si el email existe).
 *
 * TODO backend: implementar POST /api/v1/auth/forgot-password
 *   Body: { email: string }
 *   Acción: generar token de reset, enviar email con link.
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
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Siempre mostramos éxito por seguridad (no revelar si el email existe)
      setSent(true);
    } catch {
      // Error de red — igual mostramos éxito para no bloquear al usuario
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Botón volver */}
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        {sent ? (
          // ── Estado de éxito ────────────────────────────────────
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✉️</Text>
            </View>
            <Text style={styles.title}>Revisá tu email</Text>
            <Text style={styles.subtitle}>
              Si existe una cuenta con{" "}
              <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
              , recibirás un link para restablecer tu contraseña en los próximos minutos.
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
        ) : (
          // ── Formulario ─────────────────────────────────────────
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Recuperar contraseña</Text>
              <Text style={styles.subtitle}>
                Ingresá tu email y te enviaremos las instrucciones para restablecer tu contraseña.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@email.com"
                  placeholderTextColor={C.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
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
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={C.textOnBrand} />
                  : <Text style={styles.buttonText}>Enviar instrucciones</Text>
                }
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },

  // Botón volver
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
    alignSelf: "flex-start",
  },
  backBtnPressed: {
    opacity: 0.5,
  },
  backArrow: {
    fontSize: 18,
    color: C.tint,
  },
  backText: {
    fontSize: 15,
    color: C.tint,
    fontWeight: "500",
  },

  // Encabezado
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 22,
  },

  // Formulario
  form: {
    gap: Spacing.md,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.surface,
  },

  // Error
  errorBox: {
    backgroundColor: C.dangerSurface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: C.danger,
    fontWeight: "500",
  },

  // Botón
  button: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  buttonPressed: {
    backgroundColor: C.tintPressed,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: C.textOnBrand,
    fontSize: 16,
    fontWeight: "700",
  },

  // Éxito
  successWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  successEmoji: {
    fontSize: 32,
  },
  emailHighlight: {
    color: C.text,
    fontWeight: "600",
  },
  spamHint: {
    fontSize: 13,
    color: C.placeholder,
    textAlign: "center",
    marginTop: -Spacing.xs,
  },
});
