"use client";

import type { StockItemOut } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQuantity } from "@/features/stock/format";

import { StockRowActions, type StockAction } from "./stock-row-actions";

interface StockTableProps {
  items: StockItemOut[];
  canWrite: boolean;
  onAction: (action: StockAction, item: StockItemOut) => void;
}

export function StockTable({ items, canWrite, onAction }: StockTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead className="text-right">Mínimo</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <p className="font-medium">{item.name}</p>
              {item.sku ? <p className="text-xs text-muted-foreground">SKU {item.sku}</p> : null}
            </TableCell>
            <TableCell className="text-muted-foreground">{item.category ?? "—"}</TableCell>
            <TableCell className="tabular text-right">
              <span className="inline-flex items-center justify-end gap-2">
                {item.is_low_stock ? (
                  <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning-foreground">
                    Stock bajo
                  </Badge>
                ) : null}
                {formatQuantity(item.quantity, item.unit)}
              </span>
            </TableCell>
            <TableCell className="tabular text-right text-muted-foreground">
              {formatQuantity(item.min_quantity, item.unit)}
            </TableCell>
            <TableCell className="tabular text-right">{formatMoney(item.unit_cost)}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(item.unit_price)}</TableCell>
            <TableCell>
              <StockRowActions item={item} canWrite={canWrite} onAction={onAction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
