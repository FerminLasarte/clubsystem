"use client";
// apps/web/components/layout/TopBar.tsx

import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { ClubSwitcher } from "@/components/layout/ClubSwitcher";
import { useClubSession } from "@/contexts/ClubSessionContext";
import { ROLE_LABELS } from "@clubsync/types";
import { cn } from "@/lib/utils";

const ROUTE_TITLES: Record<string, string> = {
  "/":             "Resumen",
  "/reservations": "Reservas",
  "/expenses":     "Gastos",
  "/stock":        "Inventario",
  "/members":      "Socios",
  "/settings":     "Ajustes",
};

interface TopBarProps {
  onOpenSidebar?: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const pathname  = usePathname();
  const title     = ROUTE_TITLES[pathname] ?? "ClubSync";
  const { activeClub, activeRoles, userEmail } = useClubSession();

  // Iniciales del email para el avatar
  const emailInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-8">

      {/* Izquierda: hamburguesa (mobile) + título de ruta */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>

      {/* Derecha: ClubSwitcher + bell + avatar */}
      <div className="flex items-center gap-3">

        {/* ClubSwitcher: solo visible si el operador tiene más de un club */}
        <ClubSwitcher />

        {/* Notificaciones */}
        <button
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Avatar + rol */}
        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition cursor-pointer">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: activeClub?.primaryColor ?? "#111827" }}
          >
            {emailInitials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-foreground leading-none">Admin</p>
            {activeRoles.length > 0 && (
              <p className={cn("text-[10px] leading-none mt-0.5", "text-muted-foreground")}>
                {activeRoles.map((r) => ROLE_LABELS[r] ?? r).join(" · ")}
              </p>
            )}
          </div>
        </button>
      </div>
    </header>
  );
}
