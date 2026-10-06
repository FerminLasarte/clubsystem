"use client";

import type { ReservationStatus } from "@clubsystem/api";
import { RESERVATION_STATUS_LABELS } from "@clubsystem/shared";

import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HISTORY_PAGE_SIZE, useReservationHistory, type HistoryFilters as Filters } from "@/features/reservations/api";
import { addDays, parseDay } from "@/features/reservations/time";
import { useUrlParams } from "@/features/reservations/use-url-params";
import { cn } from "@/lib/utils";

import { HistoryFilters } from "./history-filters";
import { ReservationsTable } from "./reservations-table";

function isStatus(value: string | null): value is ReservationStatus {
  return value !== null && value in RESERVATION_STATUS_LABELS;
}

/** Filtros desde la URL. Por defecto: los últimos 30 días hasta hoy. */
function readFilters(params: Pick<URLSearchParams, "get">, today: string): Filters {
  const to = parseDay(params.get("to")) ?? today;
  const from = parseDay(params.get("from")) ?? addDays(to, -30);
  const status = params.get("status");
  return {
    from: from <= to ? from : to,
    to,
    status: isStatus(status) ? status : null,
    courtId: params.get("court"),
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

interface ReservationHistoryProps {
  today: string;
  timeZone: string;
  onSelect: (reservationId: string) => void;
}

export function ReservationHistory({ today, timeZone, onSelect }: ReservationHistoryProps) {
  const [params, update] = useUrlParams();
  const filters = readFilters(params, today);
  const history = useReservationHistory(filters);

  return (
    <div className="grid gap-4">
      <HistoryFilters filters={filters} onChange={(patch) => update({ ...patch, page: null })} />
      {history.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : history.isError ? (
        <QueryError error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <StateView variant="empty" title="No hay reservas" description="Probá con otro rango de fechas o filtro." />
      ) : (
        <Card className={cn("transition-opacity", history.isPlaceholderData && "opacity-60")}>
          <CardContent>
            <ReservationsTable reservations={history.data.items} timeZone={timeZone} onSelect={onSelect} />
            <Pagination
              page={filters.page}
              pageSize={HISTORY_PAGE_SIZE}
              total={history.data.total}
              onPageChange={(page) => update({ page: String(page) })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
