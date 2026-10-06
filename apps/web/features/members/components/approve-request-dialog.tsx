"use client";

import type { MemberOut } from "@clubsystem/api";
import type { FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApproveRequest } from "@/features/members/api";
import { optionalText } from "@/lib/form";

import { PlanSelect, planIdFrom } from "./plan-select";

interface ApproveRequestDialogProps {
  request: MemberOut | null;
  onClose: () => void;
}

export function ApproveRequestDialog({ request, onClose }: ApproveRequestDialogProps) {
  const approve = useApproveRequest();

  function onOpenChange(open: boolean) {
    if (open) return;
    approve.reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) return;
    const form = new FormData(event.currentTarget);
    const planId = planIdFrom(form.get("plan_id"));
    // Sin plan ni número, el backend conserva los que tuviera un socio que vuelve a pedir el alta.
    // Su plan anterior no se reenvía: si hoy está desactivado, el backend rechazaría asignarlo.
    approve.mutate(
      {
        id: request.id,
        body: {
          plan_id: planId === request.plan?.id ? null : planId,
          member_number: optionalText(form, "member_number"),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar solicitud</DialogTitle>
          <DialogDescription>
            {request ? `${request.user.first_name} ${request.user.last_name} pasa a ser socio del club. ` : null}
            El plan y el número de socio son opcionales y se pueden asignar después.
          </DialogDescription>
        </DialogHeader>
        {request ? (
          <form key={request.id} id="approve-request-form" onSubmit={onSubmit} className="grid gap-4">
            <fieldset disabled={approve.isPending} className="contents">
              <PlanSelect id="plan_id" currentPlanId={request.plan?.id ?? null} />
              <FormField
                id="member_number"
                label="N° de socio"
                defaultValue={request.member_number ?? ""}
                maxLength={50}
              />
            </fieldset>
          </form>
        ) : null}
        <FormError error={approve.error} />
        <DialogFooter>
          <Button type="submit" form="approve-request-form" disabled={approve.isPending}>
            {approve.isPending ? "Aprobando…" : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
