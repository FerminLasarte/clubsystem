"use client";

import type { FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { QueryError } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangePassword, useProfile, useUpdateProfile } from "@/features/settings/api";

export function ProfileSection() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();

  function onProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      first_name: String(form.get("first_name")),
      last_name: String(form.get("last_name")),
      phone: form.get("phone")?.toString() || null,
    });
  }

  function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    changePassword.mutate({
      current_password: String(form.get("current_password")),
      new_password: String(form.get("new_password")),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi perfil</CardTitle>
        <CardDescription>Tus datos personales son tuyos: ningún club puede modificarlos.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        {profile.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : profile.isError ? (
          <QueryError error={profile.error} onRetry={() => profile.refetch()} />
        ) : (
          <form key={profile.data.id} onSubmit={onProfile} className="grid gap-4">
            <FormField id="first_name" label="Nombre" defaultValue={profile.data.first_name} required />
            <FormField id="last_name" label="Apellido" defaultValue={profile.data.last_name} required />
            <FormField id="phone" label="Teléfono" defaultValue={profile.data.phone ?? ""} />
            <FormField id="email" label="Email" defaultValue={profile.data.email} disabled />
            <Button type="submit" disabled={update.isPending}>
              Guardar perfil
            </Button>
          </form>
        )}
        <form onSubmit={onPassword} className="grid content-start gap-4">
          <FormField id="current_password" label="Contraseña actual" type="password" autoComplete="current-password" required />
          <FormField
            id="new_password"
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            hint="Al cambiarla se cierran todas tus sesiones."
            required
          />
          <FormError error={changePassword.error} />
          <Button type="submit" variant="outline" disabled={changePassword.isPending}>
            Cambiar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
