"use client";

import type { MemberOut } from "@clubsystem/api";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MemberAction = "edit" | "toggle-status";

interface MemberRowActionsProps {
  member: MemberOut;
  onAction: (action: MemberAction, member: MemberOut) => void;
}

export function MemberRowActions({ member, onAction }: MemberRowActionsProps) {
  const name = `${member.user.first_name} ${member.user.last_name}`;
  const active = member.status === "APPROVED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para ${name}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("edit", member)}>
          <Pencil className="size-4" aria-hidden /> Editar membresía
        </DropdownMenuItem>
        <DropdownMenuItem
          variant={active ? "destructive" : "default"}
          onSelect={() => onAction("toggle-status", member)}
        >
          {active ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
          {active ? "Dar de baja" : "Reactivar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
