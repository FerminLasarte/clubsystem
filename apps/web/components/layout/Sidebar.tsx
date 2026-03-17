"use client";
// apps/web/components/layout/Sidebar.tsx

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, DollarSign,
  Package, Users, Settings, ChevronRight, LogOut, X,
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

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [club, setClub] = useState<ClubBranding | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const name         = localStorage.getItem("club_name") ?? "ClubSync";
    const primaryColor = localStorage.getItem("club_primary_color") ?? "#111827";
    const accentColor  = localStorage.getItem("club_accent_color") ?? "#3B82F6";
    const logoUrl      = localStorage.getItem("club_logo_url");
    const email        = localStorage.getItem("user_email") ?? "admin@clubsync.app";

    setClub({ name, primaryColor, accentColor, logoUrl });
    setUserEmail(email);

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

  const sidebarContent = (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">

      {/* Logo / Club Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3 min-w-0">
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
            <span className="block text-sm font-semibold text-foreground truncate">
              {club?.name ?? "ClubSync"}
            </span>
            <span className="block text-xs text-muted-foreground">Panel admin</span>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              style={isActive ? { backgroundColor: club?.primaryColor ?? "#111827" } : {}}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3 w-3 text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div className="border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: club?.primaryColor ?? "#111827" }}
          >
            {initials[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">Admin</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden md:flex">
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-300",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />

        {/* Panel */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
