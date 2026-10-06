"use client";

import { SPORT_LABELS } from "@clubsystem/shared";
import type { ClubOut, Sport } from "@clubsystem/api";
import type { FormEvent } from "react";

import { FormField } from "@/components/shared/form-field";
import { QueryError } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubSettings, useUpdateClub } from "@/features/settings/api";
import { optionalText } from "@/lib/form";

const SPORTS = Object.keys(SPORT_LABELS) as Sport[];

function ClubFormFields({ club, canEdit }: { club: ClubOut; canEdit: boolean }) {
  const update = useUpdateClub();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      name: String(form.get("name")),
      phone: optionalText(form, "phone"),
      email: optionalText(form, "email"),
      address: optionalText(form, "address"),
      city: optionalText(form, "city"),
      open_time: optionalText(form, "open_time"),
      close_time: optionalText(form, "close_time"),
      primary_color: String(form.get("primary_color")),
      accent_color: String(form.get("accent_color")),
      sport_types: form.getAll("sport_types").map(String) as Sport[],
      member_cancel_notice_hours: Number(form.get("member_cancel_notice_hours")),
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={!canEdit || update.isPending} className="contents">
        <FormField id="name" label="Nombre" defaultValue={club.name} required minLength={2} className="sm:col-span-2" />
        <FormField id="phone" label="Teléfono" defaultValue={club.phone ?? ""} />
        <FormField id="email" label="Email de contacto" type="email" defaultValue={club.email ?? ""} />
        <FormField id="address" label="Dirección" defaultValue={club.address ?? ""} />
        <FormField id="city" label="Ciudad" defaultValue={club.city ?? ""} />
        <FormField
          id="open_time"
          label="Apertura"
          type="time"
          defaultValue={club.open_time?.slice(0, 5) ?? ""}
          hint="Vacío: sin restricción horaria."
        />
        <FormField id="close_time" label="Cierre" type="time" defaultValue={club.close_time?.slice(0, 5) ?? ""} />
        <FormField
          id="member_cancel_notice_hours"
          label="Cancelación desde la app (horas antes)"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          defaultValue={club.member_cancel_notice_hours}
          hint="Hasta cuántas horas antes del inicio un socio puede cancelar una reserva confirmada. Las pendientes se cancelan siempre."
          className="sm:col-span-2"
        />
        <FormField id="primary_color" label="Color principal" type="color" defaultValue={club.primary_color} />
        <FormField id="accent_color" label="Color de acento" type="color" defaultValue={club.accent_color} />
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Deportes</legend>
          <div className="flex flex-wrap gap-4">
            {SPORTS.map((sport) => (
              <Label key={sport} className="font-normal">
                <Checkbox name="sport_types" value={sport} defaultChecked={club.sport_types.includes(sport)} />
                {SPORT_LABELS[sport]}
              </Label>
            ))}
          </div>
        </fieldset>
        {canEdit ? (
          <div className="sm:col-span-2">
            <Button type="submit">{update.isPending ? "Guardando…" : "Guardar cambios"}</Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

export function ClubForm({ canEdit }: { canEdit: boolean }) {
  const club = useClubSettings();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Club</CardTitle>
        <CardDescription>Datos que ven los socios y horario de reservas.</CardDescription>
      </CardHeader>
      <CardContent>
        {club.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : club.isError ? (
          <QueryError error={club.error} onRetry={() => club.refetch()} />
        ) : (
          <ClubFormFields key={club.data.id} club={club.data} canEdit={canEdit} />
        )}
      </CardContent>
    </Card>
  );
}
