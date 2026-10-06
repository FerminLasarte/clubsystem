import type { UserOut } from "@clubsystem/api";
import { router } from "expo-router";
import { useState } from "react";

import { errorMessage, fieldError } from "@clubsystem/api";
import { optional } from "@/shared/lib/forms";
import { Button, Card, Input, Notice, QueryState, Screen } from "@/shared/ui";

import { useProfile, useUpdateProfile } from "../hooks";

function Form({ user }: { user: UserOut }) {
  const update = useUpdateProfile();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [dni, setDni] = useState(user.dni ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "";

  const submit = () => {
    if (!canSubmit) return;
    update.mutate(
      { first_name: firstName.trim(), last_name: lastName.trim(), dni: optional(dni), phone: optional(phone) },
      { onSuccess: () => router.back() },
    );
  };

  const error = update.error;
  return (
    <Card>
      <Input label="Nombre" value={firstName} onChangeText={setFirstName} autoComplete="given-name" error={fieldError(error, "first_name")} />
      <Input label="Apellido" value={lastName} onChangeText={setLastName} autoComplete="family-name" error={fieldError(error, "last_name")} />
      <Input label="DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" error={fieldError(error, "dni")} />
      <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" error={fieldError(error, "phone")} />
      <Input label="Email" value={user.email} editable={false} hint="El email no se puede cambiar desde la app." />
      {update.isError ? <Notice tone="danger" message={errorMessage(error)} /> : null}
      <Button title="Guardar" onPress={submit} loading={update.isPending} disabled={!canSubmit} />
    </Card>
  );
}

export function EditProfileForm() {
  const profile = useProfile();
  return (
    <Screen scroll edges={["bottom"]}>
      {profile.isPending || profile.isError ? <QueryState query={profile} /> : <Form user={profile.data} />}
    </Screen>
  );
}
