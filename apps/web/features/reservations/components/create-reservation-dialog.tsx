"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CreateReservationForm } from "./create-reservation-form";
import type { SlotDefaults } from "./slot-fields";

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: SlotDefaults;
  onCreated: (reservationId: string) => void;
}

export function CreateReservationDialog({ open, onOpenChange, defaults, onCreated }: CreateReservationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
          <DialogDescription>Las reservas cargadas desde el panel quedan confirmadas.</DialogDescription>
        </DialogHeader>
        {/* El formulario se desmonta al cerrar: cada apertura empieza limpia. */}
        <CreateReservationForm defaults={defaults} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}
