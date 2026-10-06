"use client";

import type { MovementCreate, StockItemOut, StockMovementType } from "@clubsystem/api";
import { formatQuantity, STOCK_MOVEMENT_TYPE_LABELS } from "@clubsystem/shared";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMovement } from "@/features/stock/api";
import { optionalText } from "@/lib/form";

const TYPES: StockMovementType[] = ["IN", "OUT", "ADJUSTMENT"];

const QUANTITY_LABELS: Record<StockMovementType, string> = {
  IN: "Cantidad que ingresa",
  OUT: "Cantidad que sale",
  ADJUSTMENT: "Cantidad real (contada)",
};

function buildMovement(type: StockMovementType, form: FormData): MovementCreate {
  const amount = String(form.get("amount"));
  const reason = String(form.get("reason")).trim();
  if (type === "ADJUSTMENT") return { type, target_quantity: amount, reason };
  return { type, quantity: amount, reason, unit_cost: type === "IN" ? optionalText(form, "unit_cost") : null };
}

interface MovementDialogProps {
  open: boolean;
  item: StockItemOut | null;
  onOpenChange: (open: boolean) => void;
}

export function MovementDialog({ open, item, onOpenChange }: MovementDialogProps) {
  const [type, setType] = useState<StockMovementType>("IN");
  const move = useCreateMovement();

  function close(next: boolean) {
    if (!next) {
      move.reset();
      setType("IN");
    }
    onOpenChange(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const body = buildMovement(type, new FormData(event.currentTarget));
    move.mutate({ itemId: item.id, body }, { onSuccess: () => close(false) });
  }

  return (
    <Dialog open={open && item !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {item ? `${item.name} · stock actual: ${formatQuantity(item.quantity, item.unit)}` : null}
          </DialogDescription>
        </DialogHeader>
        <form id="movement-form" onSubmit={onSubmit} className="grid gap-4">
          <Tabs
            value={type}
            onValueChange={(value) => {
              setType(TYPES.find((t) => t === value) ?? "IN");
              move.reset();
            }}
          >
            <TabsList aria-label="Tipo de movimiento" className="w-full">
              {TYPES.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {STOCK_MOVEMENT_TYPE_LABELS[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <FormField
            id="amount"
            label={QUANTITY_LABELS[type]}
            type="number"
            step="any"
            // Entradas y salidas son estrictamente positivas; un ajuste puede dejar el stock en 0.
            min={type === "ADJUSTMENT" ? 0 : 0.001}
            required
            autoFocus
            hint={type === "ADJUSTMENT" ? "El stock queda exactamente en este valor." : undefined}
          />
          {type === "IN" ? (
            <FormField id="unit_cost" label="Costo unitario de esta compra ($, opcional)" type="number" min={0} step="0.01" />
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              maxLength={500}
              rows={2}
              placeholder="Ej.: compra a proveedor, rotura, inventario físico…"
            />
          </div>
        </form>
        <FormError error={move.error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="movement-form" disabled={move.isPending}>
            {move.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
