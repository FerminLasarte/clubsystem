"use client";

import type { CourtCreate, CourtOut, CourtSurface, Sport } from "@clubsystem/api";
import { SPORT_LABELS } from "@clubsystem/shared";
import type { FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCourt, useUpdateCourt } from "@/features/courts/api";
import { SURFACE_LABELS } from "@/features/courts/labels";

const SPORTS = Object.keys(SPORT_LABELS) as Sport[];
const SURFACES = Object.keys(SURFACE_LABELS) as CourtSurface[];
const NO_SURFACE = "none";

function text(form: FormData, key: string): string | null {
  const value = form.get(key)?.toString().trim() ?? "";
  return value === "" ? null : value;
}

function toBody(form: FormData): CourtCreate {
  const surface = String(form.get("surface"));
  return {
    name: String(form.get("name")),
    sport: String(form.get("sport")) as Sport,
    surface: surface === NO_SURFACE ? null : (surface as CourtSurface),
    is_indoor: form.get("is_indoor") !== null,
    capacity: Number(form.get("capacity")),
    price_member: String(form.get("price_member")),
    price_guest: String(form.get("price_guest")),
    description: text(form, "description"),
    image_url: text(form, "image_url"),
  };
}

interface CourtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null: alta de una cancha nueva. */
  court: CourtOut | null;
}

export function CourtFormDialog({ open, onOpenChange, court }: CourtFormDialogProps) {
  const create = useCreateCourt();
  const update = useUpdateCourt();
  const mutation = court ? update : create;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = toBody(new FormData(event.currentTarget));
    const close = { onSuccess: () => onOpenChange(false) };
    if (court) update.mutate({ id: court.id, body }, close);
    else create.mutate(body, close);
  }

  function onOpenChangeAndReset(next: boolean) {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAndReset}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{court ? `Editar ${court.name}` : "Nueva cancha"}</DialogTitle>
        </DialogHeader>
        <form id="court-form" key={court?.id ?? "new"} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField id="name" label="Nombre" defaultValue={court?.name} required maxLength={100} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sport">Deporte</Label>
            <Select name="sport" defaultValue={court?.sport ?? "padel"} required>
              <SelectTrigger id="sport" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {SPORT_LABELS[sport]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="surface">Superficie</Label>
            <Select name="surface" defaultValue={court?.surface ?? NO_SURFACE}>
              <SelectTrigger id="surface" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SURFACE}>Sin especificar</SelectItem>
                {SURFACES.map((surface) => (
                  <SelectItem key={surface} value={surface}>
                    {SURFACE_LABELS[surface]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField id="capacity" label="Capacidad (jugadores)" type="number" min={1} max={100} defaultValue={court?.capacity ?? 4} required />
          <Label className="self-end pb-2 font-normal">
            <Checkbox name="is_indoor" defaultChecked={court?.is_indoor ?? false} />
            Techada
          </Label>
          <FormField id="price_member" label="Precio por hora (socio)" type="number" min={0} step="0.01" defaultValue={court?.price_member} required />
          <FormField id="price_guest" label="Precio por hora (invitado)" type="number" min={0} step="0.01" defaultValue={court?.price_guest} required />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" defaultValue={court?.description ?? ""} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <FormField id="image_url" label="URL de imagen" type="url" defaultValue={court?.image_url ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <FormError error={mutation.error} />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="court-form" disabled={mutation.isPending}>
            {court ? "Guardar cambios" : "Crear cancha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
