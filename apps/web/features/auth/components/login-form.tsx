"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { AuthCard } from "@/components/shared/auth-card";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/features/auth/api";

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const login = useLogin();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate(
      { email: String(form.get("email")), password: String(form.get("password")) },
      { onSuccess: () => router.replace(safeNext(next)) },
    );
  }

  return (
    <AuthCard title="Ingresá al panel" description="Usá el email con el que te invitaron al club.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormField id="email" label="Email" type="email" autoComplete="email" required />
        <FormField id="password" label="Contraseña" type="password" autoComplete="current-password" required />
        <FormError error={login.error} />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Ingresando…" : "Ingresar"}
        </Button>
        <Link href="/forgot-password" className="text-center text-sm text-muted-foreground hover:underline">
          Olvidé mi contraseña
        </Link>
      </form>
    </AuthCard>
  );
}
