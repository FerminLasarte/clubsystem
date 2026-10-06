"use client";

import type { FeeGenerateOut } from "@clubsystem/api";
import { CalendarPlus } from "lucide-react";
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
import { useGenerateFees } from "@/features/fees/api";
import { formatMonth } from "@/lib/calendar";

function GenerateResult({ result }: { result: FeeGenerateOut }) {
  const rows = [
    { label: "Cuotas creadas", value: result.created },
    { label: "Ya existían (sin cambios)", value: result.skipped },
    { label: "Socios activos sin plan", value: result.without_plan },
  ];
  return (
    <dl role="status" className="grid gap-2 rounded-md bg-muted p-4 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="tabular font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Genera las cuotas del período elegido para los socios activos con plan. Es idempotente. */
export function GenerateDialog({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const generate = useGenerateFees();
  const period = formatMonth(year, month);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) generate.reset();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dueDay = Number(new FormData(event.currentTarget).get("due_day"));
    generate.mutate({ year, month, due_day: dueDay });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="size-4" aria-hidden /> Generar cuotas del mes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar cuotas de {period}</DialogTitle>
          <DialogDescription>
            Se crea una cuota por cada socio activo con plan. Las que ya existen no se modifican.
          </DialogDescription>
        </DialogHeader>
        {generate.data ? (
          <GenerateResult result={generate.data} />
        ) : (
          <form id="generate-form" onSubmit={onSubmit} className="grid gap-4">
            <FormField
              id="due_day"
              label="Día de vencimiento"
              type="number"
              min={1}
              max={31}
              defaultValue={10}
              required
              hint="Si el mes tiene menos días, vence el último día del mes."
            />
            <FormError error={generate.error} />
          </form>
        )}
        <DialogFooter>
          {generate.data ? (
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          ) : (
            <Button type="submit" form="generate-form" disabled={generate.isPending}>
              {generate.isPending ? "Generando…" : "Generar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
