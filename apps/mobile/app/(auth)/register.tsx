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

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Completá todos los campos");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(firstName.trim(), lastName.trim(), email.trim().toLowerCase(), password);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  // ── Estado de éxito ──────────────────────────────────────────
  if (success) {
    return (
      <View style={[styles.root, styles.successRoot, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={[styles.topAccent, { height: insets.top + 3 }]} />
        <View style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <Feather name="check" size={36} color={C.tint} />
          </View>
          <Text style={styles.successTitle}>¡Cuenta creada!</Text>
          <Text style={styles.successSubtitle}>
            Tu cuenta fue registrada exitosamente.{"\n"}
            Un administrador de tu club deberá asignarte antes de que puedas iniciar sesión.
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Franja de color superior */}
      <View style={[styles.topAccent, { height: insets.top + 3 }]} />

      {/* Círculos decorativos */}
      <View style={styles.decoCircleLg} pointerEvents="none" />
      <View style={styles.decoCircleSm} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Botón volver — navega hacia atrás en el stack, no apila */}
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={C.tint} />
          <Text style={styles.backText}>Iniciar sesión</Text>
        </Pressable>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>CS</Text>
            </View>
          </View>
        </View>

        {/* Encabezado */}
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Completá tus datos para comenzar</Text>

        {/* Formulario */}
        <View style={styles.form}>
          {/* Nombre + Apellido */}
          <View style={styles.row}>
            <View style={styles.grow}>
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
            <View style={styles.grow}>
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
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

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
            onPress={handleRegister}
            disabled={loading}
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

        {/* Footer — usa router.back() para desapilar en lugar de empujar /login */}
        <View style={styles.footerArea}>
          <View style={styles.divider} />
          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tenés cuenta?</Text>
            <Pressable hitSlop={8} onPress={() => router.back()}>
              <Text style={styles.footerLink}> Iniciar sesión</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Éxito
  successRoot: {
    paddingHorizontal: Spacing.lg,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: C.tintSubtle,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 23,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },

  // Acento superior
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.tint,
  },

  // Decoración de fondo
  decoCircleLg: {
    position: "absolute",
    top: -100,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.tintSubtle,
  },
  decoCircleSm: {
    position: "absolute",
    bottom: 80,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.tintSubtle,
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
    marginBottom: Spacing.lg,
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
  },
  backText: {
    fontSize: 15,
    color: C.tint,
    fontWeight: "500",
  },

  // Logo
  logoArea: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  logoRing: {
    padding: 6,
    borderRadius: Radius.xl + 6,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.background,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetters: {
    color: C.textOnBrand,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // Encabezado
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.7,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },

  // Formulario
  form: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },

  // Error
  errorBox: {
    backgroundColor: C.dangerSurface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: C.danger,
  },
  errorText: {
    fontSize: 13,
    color: C.danger,
    fontWeight: "500",
  },

  // Botón
  button: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
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
    letterSpacing: 0.2,
  },

  // Términos
  terms: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: -Spacing.xs,
  },
  termsLink: {
    color: C.tint,
    fontWeight: "500",
  },

  // Footer
  footerArea: {
    marginTop: Spacing.xl,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: Spacing.xl,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: C.textMuted,
  },
  footerLink: {
    fontSize: 14,
    color: C.tint,
    fontWeight: "700",
  },
});
