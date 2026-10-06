"use client";

import Link from "next/link";
import type { FormEvent } from "react";

import { AuthCard } from "@/components/shared/auth-card";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useResetPassword } from "@/features/auth/api";

export function ResetPasswordForm({ token }: { token: string }) {
  const reset = useResetPassword();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset.mutate({ token, new_password: String(new FormData(event.currentTarget).get("password")) });
  }

  if (reset.isSuccess) {
    return (
      <AuthCard title="Contraseña actualizada" description="Ya podés ingresar con tu nueva contraseña.">
        <Button asChild className="w-full">
          <Link href="/login">Ingresar</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Elegí una contraseña nueva">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormField
          id="password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={72}
          hint="Al menos 10 caracteres."
          required
        />
        <FormError error={reset.error} />
        <Button type="submit" disabled={reset.isPending || !token}>
          Guardar
        </Button>
      </form>
    </AuthCard>
  );
}
