"use client";
// apps/web/components/layout/Sidebar.tsx

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, DollarSign,
  Package, Users, Settings, ChevronRight, LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",             label: "Resumen",  icon: LayoutDashboard },
  { href: "/reservations", label: "Reservas", icon: Calendar },
  { href: "/expenses",     label: "Gastos",   icon: DollarSign },
  { href: "/stock",        label: "Stock",    icon: Package },
  { href: "/members",      label: "Socios",   icon: Users },
  { href: "/settings",     label: "Ajustes",  icon: Settings },
];

interface ClubBranding {
  name: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [club, setClub] = useState<ClubBranding | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    // Leer datos del club guardados en localStorage al momento del login
    const name         = localStorage.getItem("club_name") ?? "ClubSync";
    const primaryColor = localStorage.getItem("club_primary_color") ?? "#111827";
    const accentColor  = localStorage.getItem("club_accent_color") ?? "#3B82F6";
    const logoUrl      = localStorage.getItem("club_logo_url");
    const email        = localStorage.getItem("user_email") ?? "admin@clubsync.app";

    setClub({ name, primaryColor, accentColor, logoUrl });
    setUserEmail(email);

    // Aplicar color primario del club como variable CSS global
    document.documentElement.style.setProperty("--color-brand", primaryColor);
    document.documentElement.style.setProperty("--color-accent-club", accentColor);
  }, []);

  function handleLogout() {
    localStorage.clear();
    router.push("/login");
  }

  const initials = club?.name
    ? club.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "CS";

  return (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
      {/* Logo / Club Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white transition-colors duration-500"
          style={{ backgroundColor: club?.primaryColor ?? "#111827" }}
        >
          {club?.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={club.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900 truncate">
            {club?.name ?? "ClubSync"}
          </span>
          <span className="block text-xs text-gray-400">Panel admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
              style={isActive ? { backgroundColor: club?.primaryColor ?? "#111827" } : {}}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                )}
              />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3 w-3 text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: club?.primaryColor ?? "#111827" }}
          >
            {initials[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-gray-900">Admin</p>
            <p className="truncate text-xs text-gray-400">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
