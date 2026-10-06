"use client";

import type { ReservationGridOut } from "@clubsystem/api";
import { SPORT_LABELS } from "@clubsystem/shared";
import { useMemo } from "react";

import { StateView } from "@/components/shared/state-view";
import { Badge } from "@/components/ui/badge";
import { gridLayout } from "@/features/reservations/grid-layout";
import { minutesToTime } from "@/features/reservations/time";

import { CourtColumn } from "./court-column";

interface ReservationGridProps {
  grid: ReservationGridOut;
  onSelect: (reservationId: string) => void;
  onCreateAt?: (courtId: string, time: string) => void;
}

/** Canchas en columnas y franjas del horario del club en filas (hora local del club). */
export function ReservationGrid({ grid, onSelect, onCreateAt }: ReservationGridProps) {
  const layout = useMemo(() => gridLayout(grid), [grid]);

  if (grid.courts.length === 0) {
    return (
      <StateView
        variant="empty"
        title="No hay canchas activas"
        description="Cargá o activá una cancha en la sección Canchas para tomar reservas."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `4rem repeat(${grid.courts.length}, minmax(10rem, 1fr))` }}
      >
        <div className="sticky left-0 z-10 border-b bg-card" />
        {grid.courts.map((court) => (
          <div key={court.id} className="border-b border-l px-2 py-2">
            <p className="truncate text-sm font-medium">{court.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {SPORT_LABELS[court.sport]}
              {court.is_active ? null : <Badge variant="outline">Inactiva</Badge>}
            </p>
          </div>
        ))}
        <div className="sticky left-0 z-10 bg-card">
          {layout.rows.map((minute) => (
            <div key={minute} className="tabular h-10 border-b px-2 pt-0.5 text-xs text-muted-foreground">
              {minutesToTime(minute)}
            </div>
          ))}
        </div>
        {grid.courts.map((court) => (
          <CourtColumn
            key={court.id}
            court={court}
            rows={layout.rows}
            first={layout.first}
            slot={layout.slot}
            blocks={layout.blocks.get(court.id) ?? []}
            onSelect={onSelect}
            onCreateAt={onCreateAt}
          />
        ))}
      </div>
    </div>
  );
}
