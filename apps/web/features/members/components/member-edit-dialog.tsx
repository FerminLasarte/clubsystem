"use client";

import type { MemberOut } from "@clubsystem/api";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateMember } from "@/features/members/api";
import { optionalText } from "@/features/members/format";

import { PlanSelect, planIdFrom } from "./plan-select";

interface MemberEditDialogProps {
  member: MemberOut | null;
  onClose: () => void;
}

/** Edita la membresía (plan, número, alta y notas). Los datos personales son del socio y no se editan. */
export function MemberEditDialog({ member, onClose }: MemberEditDialogProps) {
  const update = useUpdateMember({ silent: true });

  function onOpenChange(open: boolean) {
    if (open) return;
    update.reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const form = new FormData(event.currentTarget);
    update.mutate(
      {
        id: member.id,
        body: {
          plan_id: planIdFrom(form.get("plan_id")),
          member_number: optionalText(form.get("member_number")),
          joined_on: String(form.get("joined_on")),
          notes: optionalText(form.get("notes")),
        },
      },
      {
        onSuccess: () => {
          toast.success("Membresía actualizada");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar membresía</DialogTitle>
          <DialogDescription>
            {member ? `${member.user.first_name} ${member.user.last_name} · ${member.user.email}. ` : null}
            Los datos personales los gestiona cada socio desde su cuenta.
          </DialogDescription>
        </DialogHeader>
        {member ? (
          <form key={member.id} id="member-edit-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <fieldset disabled={update.isPending} className="contents">
              <PlanSelect id="plan_id" currentPlanId={member.plan?.id ?? null} />
              <FormField id="member_number" label="N° de socio" defaultValue={member.member_number ?? ""} maxLength={50} />
              <FormField id="joined_on" label="Fecha de alta" type="date" defaultValue={member.joined_on ?? ""} required />
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" name="notes" defaultValue={member.notes ?? ""} maxLength={2000} rows={3} />
              </div>
            </fieldset>
          </form>
        ) : null}
        <FormError error={update.error} />
        <DialogFooter>
          <Button type="submit" form="member-edit-form" disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
