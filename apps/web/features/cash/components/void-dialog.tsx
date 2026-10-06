"use client";

import type { AppSchemasCashMovementOut as MovementOut } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import type { FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVoidPayment } from "@/features/cash/api";

interface VoidDialogProps {
  movement: MovementOut | null;
  onClose: () => void;
}

/** Anular un movimiento exige motivo. Si cobraba una cuota, la cuota vuelve a quedar pendiente. */
export function VoidDialog({ movement, onClose }: VoidDialogProps) {
  const voidPayment = useVoidPayment();

  function onOpenChange(open: boolean) {
    if (open) return;
    voidPayment.reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movement) return;
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();
    voidPayment.mutate({ id: movement.id, reason }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={movement !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular movimiento</DialogTitle>
          <DialogDescription>
            {movement ? `${movement.description} · ${formatMoney(movement.amount)}. ` : null}
            El movimiento queda registrado como anulado y deja de sumar en la caja.
          </DialogDescription>
        </DialogHeader>
        <form id="void-form" onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="void-reason">Motivo</Label>
            <Textarea id="void-reason" name="reason" required maxLength={255} />
          </div>
          <FormError error={voidPayment.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={voidPayment.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="void-form" variant="destructive" disabled={voidPayment.isPending}>
            {voidPayment.isPending ? "Anulando…" : "Anular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
