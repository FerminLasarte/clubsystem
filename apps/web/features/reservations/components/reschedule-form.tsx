"use client";

import type { ReservationOut } from "@clubsystem/api";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { useUpdateReservation } from "@/features/reservations/api";
import { localParts } from "@/features/reservations/time";

import { readSlot, SlotFields } from "./slot-fields";

interface RescheduleFormProps {
  reservation: ReservationOut;
  timeZone: string;
  onDone: () => void;
}

/** Cambia cancha, día, hora o duración. Si cambia la tarifa, el backend recalcula el precio. */
export function RescheduleForm({ reservation, timeZone, onDone }: RescheduleFormProps) {
  const update = useUpdateReservation();
  const start = localParts(reservation.starts_at, timeZone);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate(
      { id: reservation.id, body: readSlot(new FormData(event.currentTarget), timeZone) },
      {
        onSuccess: () => {
          toast.success("Reserva reprogramada");
          onDone();
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <SlotFields
        defaults={{
          courtId: reservation.court_id,
          day: start.day,
          time: start.time,
          duration: reservation.duration_minutes,
        }}
      />
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Si cambia la cancha o la duración, el sistema recalcula el precio.
      </p>
      <div className="sm:col-span-2">
        <FormError error={update.error} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Volver
        </Button>
        <Button type="submit" disabled={update.isPending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
