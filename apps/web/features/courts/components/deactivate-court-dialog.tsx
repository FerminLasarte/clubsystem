"use client";

import type { CourtOut } from "@clubsystem/api";
import { errorMessage } from "@clubsystem/api";
import { pluralize } from "@clubsystem/shared";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCourtUpcomingReservations, useDeactivateCourt } from "@/features/courts/api";

interface DeactivateCourtDialogProps {
  /** Cancha a desactivar; null cierra el diálogo. */
  court: CourtOut | null;
  onClose: () => void;
}

/** Desactivar una cancha con reservas próximas: muestra cuántas se cancelan y pide confirmación. */
export function DeactivateCourtDialog({ court, onClose }: DeactivateCourtDialogProps) {
  const upcoming = useCourtUpcomingReservations(court?.id ?? null);
  const deactivate = useDeactivateCourt();
  const count = upcoming.data?.upcoming_reservations;

  const description = upcoming.isError
    ? errorMessage(upcoming.error)
    : count === undefined
      ? "Contando las reservas próximas…"
      : count === 0
        ? "Ya no tiene reservas próximas. La cancha va a quedar inactiva."
        : `Tiene ${pluralize(count, "reserva próxima", "reservas próximas")} (pendientes o confirmadas, incluidas las que están en curso). ` +
          "Se van a cancelar todas y la cancha va a quedar inactiva. Si alguna tenía cobros, registrá la devolución en Caja.";

  return (
    <ConfirmDialog
      open={court !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Desactivar ${court?.name ?? "cancha"}`}
      description={description}
      confirmLabel={count ? `Cancelar ${pluralize(count, "reserva", "reservas")} y desactivar` : "Desactivar"}
      destructive
      pending={deactivate.isPending}
      confirmDisabled={count === undefined}
      onConfirm={() =>
        court &&
        count !== undefined &&
        deactivate.mutate({ id: court.id, expected: count }, { onSuccess: onClose })
      }
    />
  );
}
