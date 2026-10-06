import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";

import { errorMessage, fieldError } from "@clubsystem/api";
import { Button, Card, Input, Notice, Text } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

import { useLogin } from "../hooks";

export function LoginForm() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<TextInput>(null);
  const canSubmit = email.trim() !== "" && password.length > 0;
  const submit = () => {
    if (canSubmit) login.mutate({ email: email.trim(), password });
  };
  const emailError = fieldError(login.error, "email");

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text variant="title">ClubSystem</Text>
        <Text color="muted">Reservá canchas y seguí las novedades de tus clubes.</Text>
      </View>

      <Card>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          placeholder="tu@email.com"
          error={emailError}
        />
        <Input
          ref={passwordRef}
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {login.isError && !emailError ? <Notice tone="danger" message={errorMessage(login.error)} /> : null}
        <Button title="Ingresar" onPress={submit} loading={login.isPending} disabled={!canSubmit} />
        <Button title="Olvidé mi contraseña" variant="ghost" onPress={() => router.push("/forgot-password")} />
      </Card>

      <View style={styles.footer}>
        <Text color="muted" align="center">
          ¿Todavía no tenés cuenta?
        </Text>
        <Button title="Crear cuenta" variant="secondary" onPress={() => router.push("/register")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing.xl,
  },
  brand: {
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
});
