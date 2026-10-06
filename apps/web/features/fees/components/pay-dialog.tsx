"use client";

import type { FeeOut, PaymentMethod } from "@clubsystem/api";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@clubsystem/shared";
import type { FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePayFee } from "@/features/fees/api";

interface PayDialogProps {
  fee: FeeOut | null;
  onClose: () => void;
}

/** Cobrar una cuota pendiente: registra el ingreso en la caja de hoy. */
export function PayDialog({ fee, onClose }: PayDialogProps) {
  const pay = usePayFee();

  function onOpenChange(open: boolean) {
    if (open) return;
    pay.reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fee) return;
    const method = String(new FormData(event.currentTarget).get("method")) as PaymentMethod;
    pay.mutate({ id: fee.id, method }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={fee !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar cuota</DialogTitle>
          <DialogDescription>
            {fee ? `${fee.member_name} · ${fee.plan_name} · ${formatMoney(fee.amount)}. ` : null}
            Se registra como ingreso en la caja de hoy.
          </DialogDescription>
        </DialogHeader>
        <form id="pay-form" onSubmit={onSubmit} className="grid gap-4">
          <SelectField id="pay-method" name="method" label="Método de pago" options={PAYMENT_METHOD_LABELS} defaultValue="CASH" />
          <FormError error={pay.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pay.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-form" disabled={pay.isPending}>
            {pay.isPending ? "Cobrando…" : "Cobrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
