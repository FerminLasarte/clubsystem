"use client";

import { STAFF_ROLE_LABELS, initials } from "@clubsystem/shared";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useActiveSession, useLogout } from "@/features/auth/api";

export function UserMenu() {
  const { user, active_club } = useActiveSession();
  const logout = useLogout();
  const roles = active_club.roles.map((r) => STAFF_ROLE_LABELS[r]).join(" · ");

  return (
    <div className="flex items-center gap-3 border-t px-3 pt-4">
      <Avatar className="size-8">
        <AvatarFallback>{initials(user.first_name, user.last_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.first_name} {user.last_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{roles}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Cerrar sesión" onClick={() => logout.mutate()}>
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
