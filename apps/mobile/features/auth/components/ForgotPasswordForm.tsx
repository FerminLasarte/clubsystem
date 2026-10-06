import { router } from "expo-router";
import { useState } from "react";

import { errorMessage, fieldError } from "@clubsystem/api";
import { Button, Card, Input, Notice, Text } from "@/shared/ui";

import { useForgotPassword } from "../hooks";

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  if (forgot.isSuccess) {
    return (
      <Card>
        <Notice
          tone="success"
          title="Revisá tu correo"
          message={`Si ${email.trim()} tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva.`}
        />
        <Button title="Volver a ingresar" onPress={() => router.back()} />
      </Card>
    );
  }

  const submit = () => {
    if (email.trim() !== "") forgot.mutate(email.trim());
  };

  return (
    <Card>
      <Text color="muted">Ingresá el email de tu cuenta y te mandamos un enlace para restablecer la contraseña.</Text>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={fieldError(forgot.error, "email")}
      />
      {forgot.isError ? <Notice tone="danger" message={errorMessage(forgot.error)} /> : null}
      <Button title="Enviar enlace" onPress={submit} loading={forgot.isPending} disabled={email.trim() === ""} />
    </Card>
  );
}
