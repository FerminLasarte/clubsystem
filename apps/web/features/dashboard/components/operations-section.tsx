"use client";

import { CalendarDays, Gauge, UserPlus, Volleyball } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { QueryError } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardOperations } from "@/features/dashboard/api";

import { AttentionCard } from "./attention-card";
import { UpcomingReservations } from "./upcoming-reservations";

const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** Lo operativo del día: reservas, ocupación, solicitudes y stock bajo. */
export function OperationsSection() {
  const operations = useDashboardOperations();
  if (operations.isError) return <QueryError error={operations.error} onRetry={() => operations.refetch()} />;
  const data = operations.data;

  return (
    <section aria-labelledby="operations-title" className="grid gap-4">
      <h2 id="operations-title" className="text-lg font-semibold">
        Hoy
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reservas de hoy" value={data?.reservations_today} icon={CalendarDays} tone="info" />
        <StatCard
          label="Ocupación"
          value={data && `${percent.format(Number(data.occupancy_pct))} %`}
          hint="Horas reservadas sobre horas disponibles"
          icon={Gauge}
          tone="success"
        />
        <StatCard label="Canchas activas" value={data?.active_courts} icon={Volleyball} />
        <StatCard
          label="Solicitudes de socios"
          value={data ? (data.pending_membership_requests ?? "—") : undefined}
          icon={UserPlus}
          tone={(data?.pending_membership_requests ?? 0) > 0 ? "warning" : "neutral"}
        />
      </div>
      {data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.upcoming_reservations ? (
            <UpcomingReservations reservations={data.upcoming_reservations} className="lg:col-span-2" />
          ) : null}
          <AttentionCard pendingRequests={data.pending_membership_requests} lowStock={data.low_stock} />
        </div>
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </section>
  );
}
