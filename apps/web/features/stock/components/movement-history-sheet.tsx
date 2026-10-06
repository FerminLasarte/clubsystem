"use client";

import type { StockItemOut } from "@clubsystem/api";
import { formatDateTime } from "@clubsystem/shared";
import { useState } from "react";

import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";
import { MOVEMENTS_PAGE_SIZE, useStockMovements } from "@/features/stock/api";
import { formatDelta, formatQuantity } from "@/features/stock/format";

import { MovementTypeBadge } from "./movement-type-badge";

function MovementList({ item }: { item: StockItemOut }) {
  const timeZone = useActiveSession().active_club.timezone;
  const [page, setPage] = useState(1);
  const movements = useStockMovements(item.id, page);

  if (movements.isPending) return <Skeleton className="h-64 w-full" />;
  if (movements.isError) return <QueryError error={movements.error} onRetry={() => movements.refetch()} />;
  if (movements.data.total === 0) return <StateView variant="empty" title="Este ítem todavía no tiene movimientos" />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Variación</TableHead>
            <TableHead className="text-right">Antes → después</TableHead>
            <TableHead>Quién</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.data.items.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(movement.created_at, timeZone)}</TableCell>
              <TableCell>
                <MovementTypeBadge type={movement.type} />
              </TableCell>
              <TableCell className="tabular text-right font-medium">
                {formatDelta(movement.quantity_delta, item.unit)}
              </TableCell>
              <TableCell className="tabular text-right whitespace-nowrap text-muted-foreground">
                {formatQuantity(movement.quantity_before)} → {formatQuantity(movement.quantity_after)}
              </TableCell>
              <TableCell>{movement.performed_by_name ?? "—"}</TableCell>
              <TableCell className="max-w-56 whitespace-normal">{movement.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={page}
        pageSize={MOVEMENTS_PAGE_SIZE}
        total={movements.data.total}
        onPageChange={setPage}
      />
    </>
  );
}

interface MovementHistorySheetProps {
  open: boolean;
  item: StockItemOut | null;
  onOpenChange: (open: boolean) => void;
}

export function MovementHistorySheet({ open, item, onOpenChange }: MovementHistorySheetProps) {
  return (
    <Sheet open={open && item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Movimientos</SheetTitle>
          <SheetDescription>
            {item ? `${item.name} · stock actual: ${formatQuantity(item.quantity, item.unit)}` : null}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">{item ? <MovementList key={item.id} item={item} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}
