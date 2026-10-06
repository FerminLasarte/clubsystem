"use client";

import type { ExpenseCategory, ExpenseCreate, ExpenseOut } from "@clubsystem/api";
import { EXPENSE_CATEGORY_LABELS, todayIn } from "@clubsystem/shared";
import type { FormEvent } from "react";

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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSession } from "@/features/auth/api";
import { useCreateExpense, useUpdateExpense } from "@/features/expenses/api";
import { EXPENSE_CATEGORIES } from "@/features/expenses/labels";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = value?.toString().trim() ?? "";
  return text === "" ? null : text;
}

function readForm(form: FormData): ExpenseCreate {
  return {
    category: String(form.get("category")) as ExpenseCategory,
    description: String(form.get("description")).trim(),
    amount: String(form.get("amount")),
    expense_date: String(form.get("expense_date")),
    vendor_name: emptyToNull(form.get("vendor_name")),
    vendor_tax_id: emptyToNull(form.get("vendor_tax_id")),
    notes: emptyToNull(form.get("notes")),
  };
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null: alta. */
  expense: ExpenseOut | null;
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const { active_club } = useActiveSession();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const mutation = expense ? update : create;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = readForm(new FormData(event.currentTarget));
    const onSuccess = () => onOpenChange(false);
    if (expense) update.mutate({ id: expense.id, body }, { onSuccess });
    else create.mutate(body, { onSuccess });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          <DialogDescription>Al guardar, el sistema vuelve a analizar si el gasto es inusual.</DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <fieldset disabled={mutation.isPending} className="contents">
            <div className="grid gap-1.5">
              <Label htmlFor="category">Categoría</Label>
              <Select name="category" defaultValue={expense?.category ?? "maintenance"} required>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FormField
              id="expense_date"
              label="Fecha"
              type="date"
              required
              defaultValue={expense?.expense_date ?? todayIn(active_club.timezone)}
            />
            <FormField
              id="description"
              label="Descripción"
              required
              minLength={3}
              maxLength={500}
              defaultValue={expense?.description}
              className="sm:col-span-2"
            />
            <FormField
              id="amount"
              label="Monto ($)"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              defaultValue={expense?.amount}
            />
            <FormField id="vendor_name" label="Proveedor" maxLength={255} defaultValue={expense?.vendor_name ?? ""} />
            <FormField id="vendor_tax_id" label="CUIT" maxLength={50} defaultValue={expense?.vendor_tax_id ?? ""} />
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={expense?.notes ?? ""} />
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <FormError error={mutation.error} />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="expense-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : expense ? "Guardar cambios" : "Registrar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
