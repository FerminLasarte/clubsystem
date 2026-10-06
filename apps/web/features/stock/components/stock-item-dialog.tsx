"use client";

import type { StockItemOut, StockItemUpdate, StockUnit } from "@clubsystem/api";
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
import { useCreateStockItem, useUpdateStockItem } from "@/features/stock/api";

import { StockItemFields } from "./stock-item-fields";

function text(form: FormData, key: string): string | null {
  const value = form.get(key)?.toString().trim() ?? "";
  return value === "" ? null : value;
}

/** Datos del formulario comunes a alta y edición (vacío = sin dato). */
function itemFields(form: FormData) {
  return {
    name: text(form, "name") ?? "",
    sku: text(form, "sku"),
    category: text(form, "category"),
    description: text(form, "description"),
    unit: (text(form, "unit") ?? "unit") as StockUnit,
    min_quantity: text(form, "min_quantity") ?? "0",
    unit_cost: text(form, "unit_cost"),
    unit_price: text(form, "unit_price"),
    supplier: text(form, "supplier"),
    location: text(form, "location"),
  } satisfies StockItemUpdate;
}

interface StockItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sin ítem: alta. */
  item?: StockItemOut;
}

export function StockItemDialog({ open, onOpenChange, item }: StockItemDialogProps) {
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const mutation = item ? update : create;

  function close(next: boolean) {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const options = { onSuccess: () => close(false) };
    if (item) update.mutate({ id: item.id, body: itemFields(form) }, options);
    else create.mutate({ ...itemFields(form), quantity: text(form, "quantity") ?? "0" }, options);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `Editar ${item.name}` : "Nuevo ítem"}</DialogTitle>
          <DialogDescription>
            {item
              ? "La cantidad no se edita acá: usá “Registrar movimiento”."
              : "La cantidad inicial queda registrada como un movimiento de entrada."}
          </DialogDescription>
        </DialogHeader>
        <form id="stock-item-form" key={item?.id ?? "new"} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <StockItemFields item={item} />
          {item ? null : (
            <FormField id="quantity" label="Cantidad inicial" type="number" min={0} step="any" placeholder="0" />
          )}
        </form>
        <FormError error={mutation.error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="stock-item-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : item ? "Guardar cambios" : "Crear ítem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
