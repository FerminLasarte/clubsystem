"use client";

import type { PlanOut } from "@clubsystem/api";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreatePlan, useUpdatePlan } from "@/features/members/api";

interface PlanFormDialogProps {
  open: boolean;
  /** null: alta de un plan nuevo. */
  plan: PlanOut | null;
  onClose: () => void;
}

export function PlanFormDialog({ open, plan, onClose }: PlanFormDialogProps) {
  const create = useCreatePlan();
  const update = useUpdatePlan({ silent: true });
  const mutation = plan ? update : create;

  function onOpenChange(next: boolean) {
    if (next) return;
    create.reset();
    update.reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { name: String(form.get("name")), monthly_fee: String(form.get("monthly_fee")) };
    if (plan) {
      update.mutate(
        { id: plan.id, body },
        {
          onSuccess: () => {
            toast.success("Plan actualizado");
            onOpenChange(false);
          },
        },
      );
    } else {
      create.mutate(body, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            {plan
              ? "El cambio de cuota aplica a las cuotas que se generen de ahora en más."
              : "Los planes definen la cuota mensual de cada socio."}
          </DialogDescription>
        </DialogHeader>
        <form key={plan?.id ?? "new"} id="plan-form" onSubmit={onSubmit} className="grid gap-4">
          <fieldset disabled={mutation.isPending} className="contents">
            <FormField id="name" label="Nombre" defaultValue={plan?.name ?? ""} required maxLength={100} />
            <FormField
              id="monthly_fee"
              label="Cuota mensual"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={plan?.monthly_fee ?? ""}
              required
            />
          </fieldset>
        </form>
        <FormError error={mutation.error} />
        <DialogFooter>
          <Button type="submit" form="plan-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : plan ? "Guardar cambios" : "Crear plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
