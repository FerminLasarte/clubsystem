"use client";

import type { ReservationOut } from "@clubsystem/api";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateReservation } from "@/features/reservations/api";
import { optionalText } from "@/lib/form";

export function NotesForm({ reservation }: { reservation: ReservationOut }) {
  const update = useUpdateReservation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const notes = optionalText(new FormData(event.currentTarget), "notes");
    update.mutate(
      { id: reservation.id, body: { notes } },
      { onSuccess: () => toast.success("Notas guardadas") },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <Label htmlFor="reservation-notes">Notas</Label>
      <Textarea id="reservation-notes" name="notes" rows={2} defaultValue={reservation.notes ?? ""} />
      <FormError error={update.error} />
      <Button type="submit" variant="outline" size="sm" className="justify-self-end" disabled={update.isPending}>
        Guardar notas
      </Button>
    </form>
  );
}
