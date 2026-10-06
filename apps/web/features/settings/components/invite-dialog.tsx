"use client";

import type { StaffRole } from "@clubsystem/api";
import { STAFF_ROLE_LABELS } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useInviteStaff } from "@/features/settings/api";

/** OWNER no se asigna desde el panel (lo valida también el backend). */
export const ASSIGNABLE_ROLES: StaffRole[] = ["RESERVATIONS_MANAGER", "STOCK_MANAGER"];

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const invite = useInviteStaff();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    invite.mutate(
      { email: String(form.get("email")), roles: form.getAll("roles").map(String) as StaffRole[] },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> Invitar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar al equipo</DialogTitle>
          <DialogDescription>Le enviamos un email para que acepte y defina su contraseña.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" onSubmit={onSubmit} className="grid gap-4">
          <FormField id="email" label="Email" type="email" required />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Roles</legend>
            {ASSIGNABLE_ROLES.map((role) => (
              <Label key={role} className="font-normal">
                <Checkbox name="roles" value={role} defaultChecked={role === "RESERVATIONS_MANAGER"} />
                {STAFF_ROLE_LABELS[role]}
              </Label>
            ))}
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
