"use client";

import { daysBetween } from "@clubsystem/shared";
import { Download } from "lucide-react";
import { useState } from "react";

import { ExportButton, MAX_EXPORT_DAYS } from "@/components/shared/export-button";
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
import { exportCashCsv } from "@/features/cash/api";

interface CashExportDialogProps {
  /** Día que se está viendo: es el rango inicial. */
  day: string;
  today: string;
}

/** Exporta los movimientos de un día o de un rango (anulados incluidos, marcados). */
export function CashExportDialog({ day, today }: CashExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);
  const valid = from !== "" && to !== "" && from <= to && daysBetween(from, to) <= MAX_EXPORT_DAYS;

  function onOpenChange(next: boolean) {
    if (next) {
      setFrom(day);
      setTo(day);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" aria-hidden /> Exportar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar caja</DialogTitle>
          <DialogDescription>
            Movimientos del día o del rango, en la hora del club. Los anulados se incluyen con la fecha y el motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="cash-export-from"
            label="Desde"
            type="date"
            value={from}
            max={to || today}
            onChange={(event) => setFrom(event.target.value)}
          />
          <FormField
            id="cash-export-to"
            label="Hasta"
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        {!valid && from !== "" && to !== "" && from <= to ? (
          <p className="text-sm text-destructive">El rango máximo para exportar es de un año.</p>
        ) : null}
        <DialogFooter>
          <ExportButton
            request={() => exportCashCsv(from, to)}
            filename={from === to ? `caja-${from}.csv` : `caja-${from}-${to}.csv`}
            disabled={!valid}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
