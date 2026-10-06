"use client";

import type { StockItemOut } from "@clubsystem/api";

import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { STOCK_PAGE_SIZE, useStockItems, type StockFilters } from "@/features/stock/api";

import type { StockAction } from "./stock-row-actions";
import { StockTable } from "./stock-table";

interface StockListProps {
  filters: StockFilters;
  page: number;
  onPageChange: (page: number) => void;
  canWrite: boolean;
  onAction: (action: StockAction, item: StockItemOut) => void;
}

/** Tabla paginada con sus estados de carga, error y vacío. */
export function StockList({ filters, page, onPageChange, canWrite, onAction }: StockListProps) {
  const items = useStockItems(filters, page);
  const filtered = Boolean(filters.search || filters.category || filters.lowStock);

  if (items.isPending) return <Skeleton className="h-96 w-full" />;
  if (items.isError) return <QueryError error={items.error} onRetry={() => items.refetch()} />;
  if (items.data.total === 0) {
    return (
      <StateView
        variant="empty"
        title={filtered ? "Ningún ítem coincide con los filtros" : "Todavía no hay ítems en el inventario"}
        description={filtered ? "Probá con otra búsqueda o categoría." : undefined}
      />
    );
  }

  return (
    <div aria-busy={items.isPlaceholderData}>
      <StockTable items={items.data.items} canWrite={canWrite} onAction={onAction} />
      <Pagination page={page} pageSize={STOCK_PAGE_SIZE} total={items.data.total} onPageChange={onPageChange} />
    </div>
  );
}
