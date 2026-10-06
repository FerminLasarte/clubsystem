"use client";

import type { PlanOut } from "@clubsystem/api";
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PlanAction = "edit" | "activate" | "deactivate" | "delete";

interface PlanRowActionsProps {
  plan: PlanOut;
  onAction: (action: PlanAction, plan: PlanOut) => void;
}

export function PlanRowActions({ plan, onAction }: PlanRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para el plan ${plan.name}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("edit", plan)}>
          <Pencil className="size-4" aria-hidden /> Editar
        </DropdownMenuItem>
        {plan.is_active ? (
          <DropdownMenuItem onSelect={() => onAction("deactivate", plan)}>
            <PowerOff className="size-4" aria-hidden /> Desactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onAction("activate", plan)}>
            <Power className="size-4" aria-hidden /> Reactivar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", plan)}>
          <Trash2 className="size-4" aria-hidden /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
