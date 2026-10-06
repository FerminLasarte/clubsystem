"use client";

import { STAFF_ROLE_LABELS } from "@clubsystem/shared";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { AuthCard } from "@/components/shared/auth-card";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInvitation, useInvitation } from "@/features/auth/api";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const invitation = useInvitation(token);
  const accept = useAcceptInvitation();

  if (invitation.isPending) {
    return (
      <AuthCard title="Invitación">
        <Skeleton className="h-24 w-full" />
      </AuthCard>
    );
  }
  if (invitation.isError) {
    return <AuthCard title="Invitación no válida" description="El enlace venció o ya fue usado. Pedí una nueva invitación." />;
  }

  const inv = invitation.data;
  const roles = inv.roles.map((r) => STAFF_ROLE_LABELS[r]).join(", ");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    accept.mutate(
      {
        token,
        password: String(form.get("password")),
        first_name: form.get("first_name")?.toString(),
        last_name: form.get("last_name")?.toString(),
      },
      { onSuccess: () => router.replace("/") },
    );
  }

  return (
    <AuthCard
      title={`Sumate a ${inv.club_name}`}
      description={`Te invitaron como ${roles} con el email ${inv.email}.`}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        {inv.account === "new" ? (
          <>
            <FormField id="first_name" label="Nombre" autoComplete="given-name" required />
            <FormField id="last_name" label="Apellido" autoComplete="family-name" required />
          </>
        ) : null}
        <FormField
          id="password"
          label={inv.account === "existing" ? "Tu contraseña actual" : "Elegí una contraseña"}
          type="password"
          autoComplete={inv.account === "existing" ? "current-password" : "new-password"}
          minLength={inv.account === "existing" ? 1 : 10}
          hint={inv.account === "existing" ? undefined : "Al menos 10 caracteres."}
          required
        />
        <FormError error={accept.error} />
        <Button type="submit" disabled={accept.isPending}>
          Aceptar invitación
        </Button>
      </form>
    </AuthCard>
  );
}
