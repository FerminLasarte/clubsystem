"use client";
// apps/web/components/layout/TopBar.tsx

import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";

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
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] ?? "ClubSync";

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-8">

      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle */}
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title — driven by route */}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition">
          <Bell className="h-4 w-4" />
          {/* Unread dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Avatar */}
        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
            AD
          </div>
          <span className="text-sm font-medium text-foreground">Admin</span>
        </button>
      </div>
    </header>
  );
}
