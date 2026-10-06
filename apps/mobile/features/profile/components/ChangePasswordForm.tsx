import { useState } from "react";
import { Alert } from "react-native";

import { errorMessage, fieldError } from "@/shared/api/errors";
import { MIN_PASSWORD_LENGTH } from "@/shared/lib/forms";
import { Button, Card, Input, Notice, Screen, Text } from "@/shared/ui";

import { useChangePassword } from "../hooks";

export function ChangePasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const canSubmit = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirmation;

  const submit = () => {
    if (!canSubmit) return;
    change.mutate(
      { current, next },
      { onSuccess: () => Alert.alert("Contraseña actualizada", "Por seguridad cerramos tus sesiones. Ingresá con la contraseña nueva.") },
    );
  };

  return (
    <Screen scroll edges={["bottom"]}>
      <Card>
        <Text color="muted">Al cambiarla se cierran todas tus sesiones, incluida esta.</Text>
        <Input label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
        <Input
          label="Contraseña nueva"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={tooShort ? `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.` : fieldError(change.error, "new_password")}
        />
        <Input
          label="Repetí la contraseña nueva"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={mismatch ? "Las contraseñas no coinciden." : undefined}
        />
        {change.isError ? <Notice tone="danger" message={errorMessage(change.error)} /> : null}
        <Button title="Cambiar contraseña" onPress={submit} loading={change.isPending} disabled={!canSubmit} />
      </Card>
    </Screen>
  );
}
