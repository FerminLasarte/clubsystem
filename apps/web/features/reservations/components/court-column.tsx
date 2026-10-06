"use client";

import type { GridCourtOut } from "@clubsystem/api";

import { Button } from "@/components/ui/button";
import type { GridBlock } from "@/features/reservations/grid-layout";
import { STATUS_BLOCK_CLASS } from "@/features/reservations/status";
import { minutesToTime } from "@/features/reservations/time";
import { cn } from "@/lib/utils";

/** Alto de una franja en px (coincide con `h-10`). */
export const ROW_HEIGHT = 40;

interface CourtColumnProps {
  court: GridCourtOut;
  rows: number[];
  first: number;
  slot: number;
  blocks: GridBlock[];
  onSelect: (reservationId: string) => void;
  /** Sin permiso de escritura no se ofrece reservar desde la grilla. */
  onCreateAt?: (courtId: string, time: string) => void;
}

export function CourtColumn({ court, rows, first, slot, blocks, onSelect, onCreateAt }: CourtColumnProps) {
  const bookable = onCreateAt !== undefined && court.is_active;
  return (
    <div className="relative border-l">
      {rows.map((minute) =>
        bookable ? (
          <Button
            key={minute}
            variant="ghost"
            tabIndex={-1}
            aria-label={`Reservar ${court.name} a las ${minutesToTime(minute)}`}
            className="block h-10 w-full rounded-none border-0 border-b border-border"
            onClick={() => onCreateAt(court.id, minutesToTime(minute))}
          />
        ) : (
          <div key={minute} className="h-10 border-b" />
        ),
      )}
      {blocks.map(({ reservation, start, end }) => (
        <Button
          key={reservation.id}
          variant="ghost"
          onClick={() => onSelect(reservation.id)}
          className={cn(
            "absolute inset-x-1 h-auto flex-col items-start justify-start gap-0 overflow-hidden rounded-md border-0 border-l-4 px-2 py-1 text-left whitespace-normal",
            STATUS_BLOCK_CLASS[reservation.status],
          )}
          style={{
            top: ((start - first) / slot) * ROW_HEIGHT + 1,
            height: Math.max(((end - start) / slot) * ROW_HEIGHT - 2, ROW_HEIGHT / 2),
          }}
        >
          <span className="w-full truncate text-xs font-semibold">{reservation.customer_name}</span>
          <span className="tabular text-xs">
            {minutesToTime(start)}–{minutesToTime(end)}
          </span>
        </Button>
      ))}
    </div>
  );
}
