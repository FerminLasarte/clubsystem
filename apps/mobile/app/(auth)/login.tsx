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
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AuthInput } from "@/components/auth/AuthInput";

const C = Colors.light;

export default function LoginScreen() {
  const { login } = useAuth();
  const insets    = useSafeAreaInsets();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Completá todos los campos");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Franja de color superior — identidad de marca */}
      <View style={[styles.topAccent, { height: insets.top + 3 }]} />

      {/* Círculos decorativos de fondo */}
      <View style={styles.decoCircleLg} pointerEvents="none" />
      <View style={styles.decoCircleSm} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>CS</Text>
            </View>
          </View>
          <Text style={styles.appName}>ClubSync</Text>
        </View>

        {/* Encabezado */}
        <Text style={styles.title}>Bienvenido de vuelta</Text>
        <Text style={styles.subtitle}>Ingresá con tu cuenta para continuar</Text>

        {/* Formulario */}
        <View style={styles.form}>
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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          {/* Campo de contraseña con link de recuperación debajo */}
          <View style={styles.passwordBlock}>
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
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={styles.forgotWrap} hitSlop={8}>
                <Text style={styles.forgotLink}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            </Link>
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
          >
            {loading
              ? <ActivityIndicator color={C.textOnBrand} />
              : <Text style={styles.buttonText}>Iniciar sesión</Text>
            }
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footerArea}>
          <View style={styles.divider} />
          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No tenés cuenta?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}> Registrarse</Text>
              </Pressable>
            </Link>
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
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: C.tintSubtle,
  },
  decoCircleSm: {
    position: "absolute",
    top: 80,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.tintSubtle,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },

  // Logo
  logoArea: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  logoRing: {
    padding: 6,
    borderRadius: Radius.xl + 6,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.background,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetters: {
    color: C.textOnBrand,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  appName: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 0.5,
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
    marginBottom: Spacing.xl,
  },

  // Formulario
  form: {
    gap: Spacing.md,
  },
  passwordBlock: {
    gap: Spacing.sm,
  },
  forgotWrap: {
    alignSelf: "flex-end",
  },
  forgotLink: {
    fontSize: 13,
    color: C.tint,
    fontWeight: "500",
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
    letterSpacing: 0.2,
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
