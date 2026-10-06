"use client";

import Link from "next/link";
import type { FormEvent } from "react";

import { AuthCard } from "@/components/shared/auth-card";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useForgotPassword } from "@/features/auth/api";

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    forgot.mutate(String(new FormData(event.currentTarget).get("email")));
  }

  if (forgot.isSuccess) {
    return (
      <AuthCard
        title="Revisá tu email"
        description="Si existe una cuenta con ese email, te enviamos un enlace para elegir una contraseña nueva."
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Volver a ingresar</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Recuperar contraseña" description="Te enviamos un enlace para elegir una nueva.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormField id="email" label="Email" type="email" autoComplete="email" required />
        <Button type="submit" disabled={forgot.isPending}>
          Enviar enlace
        </Button>
      </form>
    </AuthCard>
  );
}
