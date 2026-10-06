"use client";

import type { StockItemOut } from "@clubsystem/api";
import { ArrowLeftRight, History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type StockAction = "move" | "history" | "edit" | "delete";

interface StockRowActionsProps {
  item: StockItemOut;
  canWrite: boolean;
  onAction: (action: StockAction, item: StockItemOut) => void;
}

export function StockRowActions({ item, canWrite, onAction }: StockRowActionsProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones de ${item.name}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canWrite ? (
          <DropdownMenuItem onSelect={() => onAction("move", item)}>
            <ArrowLeftRight aria-hidden /> Registrar movimiento
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onAction("history", item)}>
          <History aria-hidden /> Ver movimientos
        </DropdownMenuItem>
        {canWrite ? (
          <>
            <DropdownMenuItem onSelect={() => onAction("edit", item)}>
              <Pencil aria-hidden /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", item)}>
              <Trash2 aria-hidden /> Eliminar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
