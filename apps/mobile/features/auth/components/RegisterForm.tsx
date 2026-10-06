import { useState } from "react";
import { Alert } from "react-native";

import { errorMessage, fieldError } from "@/shared/api/errors";
import { MIN_PASSWORD_LENGTH, optional } from "@/shared/lib/forms";
import { Button, Card, Input, Notice } from "@/shared/ui";

import { useRegister } from "../hooks";

export function RegisterForm() {
  const register = useRegister();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= MIN_PASSWORD_LENGTH;

  const submit = () => {
    if (!canSubmit) return;
    register.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        dni: optional(dni),
        phone: optional(phone),
      },
      {
        onSuccess: (data) =>
          Alert.alert(
            "Confirmá tu email",
            `Te enviamos un enlace a ${data.user.email}. Lo necesitás para pedir ser socio de un club.`,
          ),
      },
    );
  };

  const error = register.error;
  return (
    <Card>
      <Input label="Nombre" value={firstName} onChangeText={setFirstName} autoComplete="given-name" error={fieldError(error, "first_name")} />
      <Input label="Apellido" value={lastName} onChangeText={setLastName} autoComplete="family-name" error={fieldError(error, "last_name")} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        error={fieldError(error, "email")}
        hint="Te vamos a mandar un enlace para confirmarlo."
      />
      <Input
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={passwordTooShort ? `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.` : fieldError(error, "password")}
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
      />
      <Input
        label="DNI (opcional)"
        value={dni}
        onChangeText={setDni}
        keyboardType="number-pad"
        error={fieldError(error, "dni")}
        hint="Con tu DNI también podés ingresar."
      />
      <Input label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" error={fieldError(error, "phone")} />
      {register.isError ? <Notice tone="danger" message={errorMessage(error)} /> : null}
      <Button title="Crear cuenta" onPress={submit} loading={register.isPending} disabled={!canSubmit} />
    </Card>
  );
}
