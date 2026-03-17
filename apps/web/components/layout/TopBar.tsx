"use client";
// apps/web/components/layout/TopBar.tsx

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

const ROUTE_TITLES: Record<string, string> = {
  "/":            "Resumen",
  "/reservations":"Reservas",
  "/expenses":    "Gastos",
  "/stock":       "Inventario",
  "/members":     "Socios",
  "/settings":    "Ajustes",
};

export function TopBar() {
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] ?? "ClubSync";

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8">
      {/* Page title — driven by route */}
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition">
          <Bell className="h-4 w-4" />
          {/* Unread dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-100" />

        {/* Avatar */}
        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
            AD
          </div>
          <span className="text-sm font-medium text-gray-700">Admin</span>
        </button>
      </div>
    </header>
  );
}
