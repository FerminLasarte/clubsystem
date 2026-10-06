"use client";

import type { FeeOut } from "@clubsystem/api";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { FEES_PAGE_SIZE, useCancelFee, useFees, type FeeFilters } from "@/features/fees/api";
import { cn } from "@/lib/utils";

import { FeesTable } from "./fees-table";
import { PayDialog } from "./pay-dialog";

interface FeesListProps {
  filters: FeeFilters;
  canWrite: boolean;
  onPageChange: (page: number) => void;
}

/** Tabla paginada con sus estados (cargando, error, vacío) y las acciones de cobrar y anular. */
export function FeesList({ filters, canWrite, onPageChange }: FeesListProps) {
  const fees = useFees(filters);
  const cancel = useCancelFee();
  const [toPay, setToPay] = useState<FeeOut | null>(null);
  const [toCancel, setToCancel] = useState<FeeOut | null>(null);

  if (fees.isPending) return <Skeleton className="h-72 w-full" />;
  if (fees.isError) return <QueryError error={fees.error} onRetry={() => fees.refetch()} />;
  if (fees.data.total === 0) {
    const filtered = filters.status !== null || filters.search.trim() !== "";
    return (
      <StateView
        variant="empty"
        title={filtered ? "Ninguna cuota coincide con los filtros" : "No hay cuotas en este mes"}
        description={filtered ? undefined : "Generá las cuotas del mes para los socios activos con plan."}
      />
    );
  }

  return (
    <div className={cn(fees.isPlaceholderData && "opacity-60 transition-opacity")}>
      <FeesTable fees={fees.data.items} canWrite={canWrite} onPay={setToPay} onCancel={setToCancel} />
      <Pagination page={fees.data.page} pageSize={FEES_PAGE_SIZE} total={fees.data.total} onPageChange={onPageChange} />
      <PayDialog fee={toPay} onClose={() => setToPay(null)} />
      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title="Anular cuota"
        description={`La cuota de ${toCancel?.member_name ?? ""} deja de estar pendiente y no se cobra.`}
        confirmLabel="Anular cuota"
        destructive
        pending={cancel.isPending}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id, { onSuccess: () => setToCancel(null) })}
      />
    </div>
  );
}
