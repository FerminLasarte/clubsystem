"use client";

import type { ReservationStatus } from "@clubsystem/api";
import { RESERVATION_STATUS_LABELS } from "@clubsystem/shared";
import { Download } from "lucide-react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourts } from "@/features/courts/api";
import { exportUrl, type HistoryFilters as Filters } from "@/features/reservations/api";
import { daysBetween } from "@/features/reservations/time";

const ALL = "all";
const STATUSES = Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[];
const MAX_EXPORT_DAYS = 366;

interface HistoryFiltersProps {
  filters: Filters;
  onChange: (patch: Partial<Record<"from" | "to" | "status" | "court", string | null>>) => void;
}

export function HistoryFilters({ filters, onChange }: HistoryFiltersProps) {
  const courts = useCourts();
  const canExport = daysBetween(filters.from, filters.to) <= MAX_EXPORT_DAYS;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField
        id="history-from"
        label="Desde"
        type="date"
        value={filters.from}
        max={filters.to}
        onChange={(event) => event.target.value && onChange({ from: event.target.value })}
      />
      <FormField
        id="history-to"
        label="Hasta"
        type="date"
        value={filters.to}
        min={filters.from}
        onChange={(event) => event.target.value && onChange({ to: event.target.value })}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="history-status">Estado</Label>
        <Select value={filters.status ?? ALL} onValueChange={(v) => onChange({ status: v === ALL ? null : v })}>
          <SelectTrigger id="history-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {RESERVATION_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="history-court">Cancha</Label>
        <Select value={filters.courtId ?? ALL} onValueChange={(v) => onChange({ court: v === ALL ? null : v })}>
          <SelectTrigger id="history-court" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {courts.data?.map((court) => (
              <SelectItem key={court.id} value={court.id}>
                {court.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="ml-auto grid gap-1">
        {canExport ? (
          <Button variant="outline" asChild>
            <a href={exportUrl(filters.from, filters.to)} download>
              <Download className="size-4" aria-hidden /> Exportar CSV
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <Download className="size-4" aria-hidden /> Exportar CSV
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {canExport ? "Todas las reservas del rango de fechas." : "El rango máximo para exportar es de un año."}
        </p>
      </div>
    </div>
  );
}
