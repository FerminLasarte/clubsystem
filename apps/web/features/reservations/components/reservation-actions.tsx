"use client";

import type { ReservationOut } from "@clubsystem/api";
import { CalendarClock, Check, X } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useCancelReservation, useConfirmReservation } from "@/features/reservations/api";
import { isActive } from "@/features/reservations/status";

interface ReservationActionsProps {
  reservation: ReservationOut;
  onReschedule: () => void;
}

export function ReservationActions({ reservation, onReschedule }: ReservationActionsProps) {
  const confirm = useConfirmReservation();
  const cancel = useCancelReservation();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!isActive(reservation.status)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {reservation.status === "pending" ? (
        <Button onClick={() => confirm.mutate(reservation.id)} disabled={confirm.isPending}>
          <Check className="size-4" aria-hidden /> Confirmar
        </Button>
      ) : null}
      <Button variant="outline" onClick={onReschedule}>
        <CalendarClock className="size-4" aria-hidden /> Reprogramar
      </Button>
      <Button variant="destructive" onClick={() => setCancelOpen(true)}>
        <X className="size-4" aria-hidden /> Cancelar reserva
      </Button>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar reserva"
        description={`Se libera la cancha para ${reservation.customer_name}. Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar reserva"
        destructive
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate(reservation.id, { onSettled: () => setCancelOpen(false) })}
      />
    </div>
  );
}
