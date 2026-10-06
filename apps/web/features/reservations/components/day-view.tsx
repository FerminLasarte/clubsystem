"use client";

import { RESERVATION_STATUS_LABELS } from "@clubsystem/shared";

import { QueryError } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservationGrid } from "@/features/reservations/api";
import { STATUS_BLOCK_CLASS } from "@/features/reservations/status";
import { cn } from "@/lib/utils";

import { DayNav } from "@/components/shared/day-nav";
import { PendingNotice } from "./pending-notice";
import { ReservationGrid } from "./reservation-grid";

const LEGEND = ["pending", "confirmed", "completed"] as const;

interface DayViewProps {
  day: string;
  today: string;
  onDayChange: (day: string) => void;
  onSelect: (reservationId: string) => void;
  onCreateAt?: (courtId: string, time: string) => void;
}

export function DayView({ day, today, onDayChange, onSelect, onCreateAt }: DayViewProps) {
  const grid = useReservationGrid(day);

  return (
    <div className="grid gap-4">
      <DayNav day={day} today={today} onChange={onDayChange} showLabel />
      <PendingNotice day={day} isToday={day === today} />
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Referencias">
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-4 rounded-xs border-l-4", STATUS_BLOCK_CLASS[status])} aria-hidden />
            {RESERVATION_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
      {grid.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : grid.isError ? (
        <QueryError error={grid.error} onRetry={() => grid.refetch()} />
      ) : (
        <div className={cn("transition-opacity", grid.isPlaceholderData && "opacity-60")}>
          <ReservationGrid grid={grid.data} onSelect={onSelect} onCreateAt={onCreateAt} />
        </div>
      )}
    </div>
  );
}
