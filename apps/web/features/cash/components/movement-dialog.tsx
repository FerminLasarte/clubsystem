"use client";

import type { PaymentMethod, TransactionType } from "@clubsystem/api";
import { PAYMENT_METHOD_LABELS } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreatePayment } from "@/features/cash/api";

import { MemberPicker } from "./member-picker";
import { TRANSACTION_TYPE_LABELS } from "./movement-type-badge";

export function MovementDialog({ canPickMember }: { canPickMember: boolean }) {
  const [open, setOpen] = useState(false);
  const create = useCreatePayment();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) create.reset();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate(
      {
        type: String(form.get("type")) as TransactionType,
        method: String(form.get("method")) as PaymentMethod,
        amount: String(form.get("amount")),
        description: String(form.get("description")).trim(),
        membership_id: form.get("membership_id")?.toString() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> Registrar movimiento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>Se registra con la fecha y hora actuales.</DialogDescription>
        </DialogHeader>
        <form id="movement-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <SelectField id="movement-type" name="type" label="Tipo" options={TRANSACTION_TYPE_LABELS} defaultValue="INCOME" />
          <SelectField id="movement-method" name="method" label="Método" options={PAYMENT_METHOD_LABELS} defaultValue="CASH" />
          <FormField id="amount" label="Monto" type="number" inputMode="decimal" min="0.01" step="0.01" required />
          <FormField id="description" label="Descripción" required maxLength={255} />
          {canPickMember ? (
            <div className="sm:col-span-2">
              <MemberPicker />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <FormError error={create.error} />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="movement-form" disabled={create.isPending}>
            {create.isPending ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
