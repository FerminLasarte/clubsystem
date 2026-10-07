"use client";

import { errorMessage, type MemberOut, type ReservationCreate } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSession } from "@/features/auth/api";
import { useCreateReservation, useReservationQuote } from "@/features/reservations/api";
import { optionalText } from "@/lib/form";

import { MemberPicker } from "./member-picker";
import {
  completeSlot,
  readSlot,
  readSlotValues,
  SlotFields,
  slotValuesFromDefaults,
  type SlotDefaults,
} from "./slot-fields";

type Customer = "member" | "guest";

const CUSTOMERS: { value: Customer; label: string }[] = [
  { value: "member", label: "Socio" },
  { value: "guest", label: "Invitado" },
];

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
  // Cancha, fecha, hora y duración actuales, para cotizar antes de crear.
  const [slotValues, setSlotValues] = useState(() => slotValuesFromDefaults(defaults));
  const slot = completeSlot(slotValues, active_club.timezone);
  const customerType = customer === "member" ? "MEMBER" : "GUEST";
  const quote = useReservationQuote(slot && { ...slot, customer_type: customerType });

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
    <form
      onSubmit={onSubmit}
      onChange={(event) => setSlotValues(readSlotValues(new FormData(event.currentTarget)))}
      className="grid gap-4 sm:grid-cols-2"
    >
      <SlotFields defaults={defaults} />
      <fieldset className="grid gap-3 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Cliente</legend>
        <Tabs value={customer} onValueChange={(value) => setCustomer(value === "guest" ? "guest" : "member")}>
          <TabsList aria-label="Tipo de cliente">
            {CUSTOMERS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
        <QuotePreview
          quote={quote}
          ready={slot !== null}
          rateLabel={customer === "member" ? "socio" : "invitado"}
          overridden={overridePrice}
        />
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

interface QuotePreviewProps {
  quote: ReturnType<typeof useReservationQuote>;
  ready: boolean;
  rateLabel: string;
  overridden: boolean;
}

/** Precio que calcula el backend con la tarifa de la cancha, antes de crear la reserva. */
function QuotePreview({ quote, ready, rateLabel, overridden }: QuotePreviewProps) {
  if (!ready) return <p className="text-muted-foreground">Elegí cancha, fecha y hora para ver el precio.</p>;
  if (quote.isError) {
    return (
      <p role="alert" className="text-destructive">
        No pudimos calcular el precio: {errorMessage(quote.error)}
      </p>
    );
  }
  if (quote.data === undefined) return <p className="text-muted-foreground">Calculando el precio…</p>;
  return (
    <p aria-live="polite" className={quote.isPlaceholderData ? "opacity-60" : undefined}>
      Precio con la tarifa de {rateLabel}: <span className="font-medium">{formatMoney(quote.data)}</span>
      {overridden ? <span className="text-muted-foreground"> · Se cobra el precio que cargues.</span> : null}
    </p>
  );
}
