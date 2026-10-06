"use client";

import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
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
import { useCreateMember } from "@/features/members/api";
import { optionalText } from "@/features/members/format";

import { PlanSelect, planIdFrom } from "./plan-select";

export function MemberCreateDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateMember();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) create.reset();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate(
      {
        email: String(form.get("email")).trim(),
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        phone: optionalText(form.get("phone")),
        plan_id: planIdFrom(form.get("plan_id")),
        member_number: optionalText(form.get("member_number")),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" aria-hidden /> Invitar socio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar socio</DialogTitle>
          <DialogDescription>
            Le enviamos una invitación por email y queda como socio cuando la acepta desde la app. Si todavía no tiene
            cuenta, la creamos con el nombre y teléfono que cargues y le pedimos que elija su contraseña. Sus datos
            personales (DNI, etc.) los completa la persona en su perfil.
          </DialogDescription>
        </DialogHeader>
        <form id="member-create-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <fieldset disabled={create.isPending} className="contents">
            <div className="sm:col-span-2">
              <FormField id="email" label="Email" type="email" autoComplete="off" required />
            </div>
            <FormField id="first_name" label="Nombre" required maxLength={100} />
            <FormField id="last_name" label="Apellido" required maxLength={100} />
            <FormField id="phone" label="Teléfono" type="tel" maxLength={50} />
            <PlanSelect id="plan_id" />
            <FormField id="member_number" label="N° de socio" maxLength={50} />
          </fieldset>
        </form>
        <FormError error={create.error} />
        <DialogFooter>
          <Button type="submit" form="member-create-form" disabled={create.isPending}>
            {create.isPending ? "Enviando…" : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
