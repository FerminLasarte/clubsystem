"use client";

import type { MemberOut, ReservationCreate } from "@clubsystem/api";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSession } from "@/features/auth/api";
import { useCreateReservation } from "@/features/reservations/api";

import { MemberPicker } from "./member-picker";
import { readSlot, SlotFields, type SlotDefaults } from "./slot-fields";

type Customer = "member" | "guest";

const CUSTOMERS: { value: Customer; label: string }[] = [
  { value: "member", label: "Socio" },
  { value: "guest", label: "Invitado" },
];

function optionalText(form: FormData, key: string): string | null {
  const value = form.get(key)?.toString().trim() ?? "";
  return value === "" ? null : value;
}

interface CreateReservationFormProps {
  defaults: SlotDefaults;
  onCreated: (reservationId: string) => void;
}

export function CreateReservationForm({ defaults, onCreated }: CreateReservationFormProps) {
  const { active_club } = useActiveSession();
  const create = useCreateReservation();
  const [customer, setCustomer] = useState<Customer>("member");
  const [member, setMember] = useState<MemberOut | null>(null);
  const [overridePrice, setOverridePrice] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerFields =
      customer === "member"
        ? { membership_id: member?.id ?? null }
        : { guest_name: optionalText(form, "guest_name"), guest_phone: optionalText(form, "guest_phone") };
    const body: ReservationCreate = {
      ...readSlot(form, active_club.timezone),
      ...customerFields,
      price_override: overridePrice ? String(form.get("price_override")) : null,
      notes: optionalText(form, "notes"),
    };
    create.mutate(body, { onSuccess: (reservation) => onCreated(reservation.id) });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <SlotFields defaults={defaults} />
      <fieldset className="grid gap-3 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Cliente</legend>
        <div className="flex gap-2">
          {CUSTOMERS.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={customer === value ? "default" : "outline"}
              aria-pressed={customer === value}
              onClick={() => setCustomer(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {customer === "member" ? (
          <MemberPicker value={member} onChange={setMember} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="guest_name" label="Nombre del invitado" required maxLength={200} />
            <FormField id="guest_phone" label="Teléfono" type="tel" maxLength={50} />
          </div>
        )}
      </fieldset>
      <div className="grid gap-2 rounded-md bg-muted px-3 py-2 text-sm sm:col-span-2">
        <p className="text-muted-foreground">
          El precio lo calcula el sistema con la tarifa de la cancha ({customer === "member" ? "socio" : "invitado"}) y la
          duración. Lo vas a ver al crear la reserva.
        </p>
        <Label className="font-normal">
          <Checkbox checked={overridePrice} onCheckedChange={(checked) => setOverridePrice(checked === true)} />
          Cobrar un precio distinto
        </Label>
        {overridePrice ? (
          <FormField id="price_override" label="Precio final" type="number" min={0} step="0.01" required />
        ) : null}
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <div className="sm:col-span-2">
        <FormError error={create.error} />
      </div>
      <DialogFooter className="sm:col-span-2">
        <Button type="submit" disabled={create.isPending || (customer === "member" && member === null)}>
          {create.isPending ? "Creando…" : "Crear reserva"}
        </Button>
      </DialogFooter>
    </form>
  );
}
