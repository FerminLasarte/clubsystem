"use client";

import type { StockItemOut } from "@clubsystem/api";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButton } from "@/components/shared/export-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveSession } from "@/features/auth/api";
import { exportStockCsv, useDeleteStockItem } from "@/features/stock/api";
import { useStockFilters } from "@/features/stock/hooks";

import { MovementDialog } from "./movement-dialog";
import { MovementHistorySheet } from "./movement-history-sheet";
import { StockFilters } from "./stock-filters";
import { StockItemDialog } from "./stock-item-dialog";
import { StockList } from "./stock-list";
import type { StockAction } from "./stock-row-actions";
import { StockStats } from "./stock-stats";

type Selected = { action: StockAction; item: StockItemOut } | null;

export function StockView() {
  const canWrite = useActiveSession().permissions.includes("stock:write");
  const { filters, page, setPage, setFilters } = useStockFilters();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Selected>(null);
  // El ítem se conserva al cerrar para que el diálogo no cambie de contenido durante la animación.
  const [open, setOpen] = useState(false);
  const remove = useDeleteStockItem();

  const itemFor = (action: StockAction) => (selected?.action === action ? selected.item : null);
  const isOpen = (action: StockAction) => open && selected?.action === action;
  const onAction = (action: StockAction, item: StockItemOut) => {
    setSelected({ action, item });
    setOpen(true);
  };
  const toDelete = itemFor("delete");

  return (
    <>
      <PageHeader
        title="Stock"
        description="Inventario del club. Toda variación de cantidad queda registrada como movimiento."
        actions={
          <>
            <ExportButton request={() => exportStockCsv(filters)} filename="stock.csv" />
            {canWrite ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden /> Nuevo ítem
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6">
        <StockStats />
        <Card>
          <CardContent className="grid gap-4">
            <StockFilters filters={filters} onChange={setFilters} />
            <StockList
              filters={filters}
              page={page}
              onPageChange={setPage}
              canWrite={canWrite}
              onAction={onAction}
            />
          </CardContent>
        </Card>
      </div>

      <StockItemDialog open={creating} onOpenChange={setCreating} />
      <StockItemDialog open={isOpen("edit")} onOpenChange={setOpen} item={itemFor("edit") ?? undefined} />
      <MovementDialog open={isOpen("move")} item={itemFor("move")} onOpenChange={setOpen} />
      <MovementHistorySheet open={isOpen("history")} item={itemFor("history")} onOpenChange={setOpen} />
      <ConfirmDialog
        open={isOpen("delete")}
        onOpenChange={setOpen}
        title="Eliminar ítem"
        description={`“${toDelete?.name ?? ""}” deja de aparecer en el inventario. Su historial de movimientos se conserva.`}
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setOpen(false) })}
      />
    </>
  );
}
