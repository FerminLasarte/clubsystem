"use client";

import { useState } from "react";

import { QueryError } from "@/components/shared/state-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession } from "@/features/auth/api";
import { useReservation } from "@/features/reservations/api";

import { NotesForm } from "./notes-form";
import { RescheduleForm } from "./reschedule-form";
import { ReservationActions } from "./reservation-actions";
import { ReservationSummary } from "./reservation-summary";

function DetailBody({ id }: { id: string }) {
  const { active_club, permissions } = useActiveSession();
  const canWrite = permissions.includes("reservations:write");
  const reservation = useReservation(id);
  const [rescheduling, setRescheduling] = useState(false);
  const timeZone = active_club.timezone;

  if (reservation.isPending) return <Skeleton className="h-64 w-full" />;
  if (reservation.isError) return <QueryError error={reservation.error} onRetry={() => reservation.refetch()} />;

  const r = reservation.data;
  if (rescheduling) {
    return <RescheduleForm reservation={r} timeZone={timeZone} onDone={() => setRescheduling(false)} />;
  }
  return (
    <div className="grid gap-4">
      <ReservationSummary reservation={r} timeZone={timeZone} />
      <Separator />
      {canWrite ? (
        <>
          <NotesForm key={r.id} reservation={r} />
          <ReservationActions reservation={r} onReschedule={() => setRescheduling(true)} />
        </>
      ) : (
        <div className="grid gap-0.5">
          <p className="text-xs text-muted-foreground">Notas</p>
          <p className="text-sm whitespace-pre-line">{r.notes ?? "—"}</p>
        </div>
      )}
    </div>
  );
}

interface ReservationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se conserva al cerrar para que el contenido no desaparezca durante la animación. */
  reservationId: string | null;
}

export function ReservationDetailDialog({ open, onOpenChange, reservationId }: ReservationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reserva</DialogTitle>
          <DialogDescription className="sr-only">Detalle y acciones de la reserva.</DialogDescription>
        </DialogHeader>
        {reservationId ? <DetailBody key={reservationId} id={reservationId} /> : null}
      </DialogContent>
    </Dialog>
  );
}
