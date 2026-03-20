"use client";
// apps/web/components/layout/Sidebar.tsx
//
// Sidebar RBAC-aware: filtra los ítems de navegación según los roles activos
// del operador (consumido desde ClubSessionContext).
//
// Lógica multi-rol: un operador puede tener varios roles simultáneamente.
// Se muestra la UNIÓN de las rutas permitidas por todos sus roles.
//
// Roles y rutas visibles:
//   OWNER                → todas las rutas
//   RESERVATIONS_MANAGER → /, /reservations, /members
//   STOCK_MANAGER        → /, /stock
//   Combinado RM + SM    → /, /reservations, /members, /stock

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, DollarSign,
  LayoutGrid, Package, Users, Settings, ChevronRight, LogOut, X, Bell, Wallet,
} from "lucide-react";
import { useClubSession } from "@/contexts/ClubSessionContext";
import { ROLE_PERMISSIONS } from "@clubsync/types";

// ── Definición completa de la navegación ─────────────────────
// El filtrado ocurre en runtime según el rol activo.
const ALL_NAV_ITEMS = [
  { href: "/",             label: "Resumen",  icon: LayoutDashboard },
  { href: "/reservations", label: "Reservas", icon: Calendar },
  { href: "/courts",       label: "Canchas",  icon: LayoutGrid },
  { href: "/expenses",     label: "Gastos",   icon: DollarSign },
  { href: "/stock",        label: "Stock",    icon: Package },
  { href: "/members",      label: "Socios",   icon: Users },
  { href: "/cash",         label: "Caja",     icon: Wallet },
  { href: "/settings",     label: "Ajustes",  icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  // Datos del club activo y roles — provistos por ClubSessionContext
  const { activeClub, activeRoles, userEmail } = useClubSession();

  // ── Filtrar nav según los roles activos ───────────────────
  // Calcula la UNIÓN de rutas permitidas por todos los roles del operador.
  // Si activeRoles está vacío (sesión cargando) se muestran todos los ítems
  // para evitar parpadeos — el backend protege las rutas en cualquier caso.
  const allowedPaths: string[] = activeRoles.length > 0
    ? [...new Set(activeRoles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))]
    : ALL_NAV_ITEMS.map((n) => n.href);

  const visibleNavItems = ALL_NAV_ITEMS.filter(({ href }) => allowedPaths.includes(href));

  // ── Branding derivado del contexto ────────────────────────
  const primaryColor = activeClub?.primaryColor ?? "#111827";
  const clubName     = activeClub?.clubName ?? "ClubSync";
  const logoUrl      = activeClub?.logoUrl ?? null;

  const initials = clubName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const emailInitial = userEmail ? userEmail[0].toUpperCase() : "A";

  function handleLogout() {
    localStorage.clear();
    // Eliminar cookie de sesión para que el middleware redirija al /login.
    document.cookie = "has_session=; path=/; max-age=0; SameSite=Strict";
    router.push("/login");
  }

  // ── Contenido compartido desktop + mobile ─────────────────
  const sidebarContent = (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">

      {/* Header: logo/nombre del club */}
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white transition-colors duration-500"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={clubName}
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground truncate">
              {clubName}
            </span>
            <span className="block text-xs text-muted-foreground">Panel admin</span>
          </div>
        </div>

        {/* Botón cerrar — solo mobile */}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navegación filtrada por rol */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-4">
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer",
                isActive
                  ? "text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              style={isActive ? { backgroundColor: primaryColor } : {}}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3 w-3 text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer: usuario + cerrar sesión */}
      <div className="border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {emailInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">Admin</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        <button
          className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          aria-label="Notificaciones"
        >
          <div className="relative">
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          </div>
          Notificaciones
        </button>

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
      {/* Desktop: sidebar estático */}
      <div className="hidden md:flex">
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-300",
          isOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />

        {/* Panel deslizante */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
