import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/shared/api/errors";
import { Button, Card, Input, Notice, Text } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

import { useLogin } from "../hooks";

export function LoginForm() {
  const login = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = identifier.trim().length >= 3 && password.length > 0;

  const submit = () => {
    if (canSubmit) login.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text variant="title">ClubSystem</Text>
        <Text color="muted">Reservá canchas y seguí las novedades de tus clubes.</Text>
      </View>

      <Card>
        <Input
          label="Email o DNI"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          placeholder="tu@email.com o 30123456"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {login.isError ? <Notice tone="danger" message={errorMessage(login.error)} /> : null}
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
