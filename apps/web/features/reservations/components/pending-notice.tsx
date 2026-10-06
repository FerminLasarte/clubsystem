"use client";

import { pluralize } from "@clubsystem/shared";
import { BellRing } from "lucide-react";

import { usePendingCount } from "@/features/reservations/api";

/** Aviso de reservas de la app que esperan confirmación (vencen solas al llegar su horario). */
export function PendingNotice({ day, isToday }: { day: string; isToday: boolean }) {
  const pending = usePendingCount(day);

  if (pending.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos contar las reservas pendientes de confirmar.
      </p>
    );
  }
  if (!pending.data) return null;

  return (
    <div role="status" className="flex items-start gap-3 rounded-lg bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
      <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong>
          {pluralize(pending.data, "reserva pendiente", "reservas pendientes")} de confirmar {isToday ? "hoy" : "este día"}.
        </strong>{" "}
        Llegan desde la app y se cancelan solas si no se confirman antes de empezar.
      </p>
    </div>
  );
}
