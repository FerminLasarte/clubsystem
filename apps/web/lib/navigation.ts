import type { Permission } from "@clubsystem/api";
import {
  Banknote,
  Boxes,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  ReceiptText,
  Settings,
  Users,
  Volleyball,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** null = cualquier miembro del staff. */
  permission: Permission | null;
}

/** Única fuente para el menú y para el guard de rutas. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, permission: "dashboard:operations" },
  { href: "/reservations", label: "Reservas", icon: CalendarDays, permission: "reservations:read" },
  { href: "/courts", label: "Canchas", icon: Volleyball, permission: "courts:read" },
  { href: "/members", label: "Socios", icon: Users, permission: "members:read" },
  { href: "/stock", label: "Stock", icon: Boxes, permission: "stock:read" },
  { href: "/cash", label: "Caja", icon: Wallet, permission: "cash:read" },
  { href: "/fees", label: "Cuotas", icon: Banknote, permission: "fees:read" },
  { href: "/expenses", label: "Gastos", icon: ReceiptText, permission: "expenses:read" },
  { href: "/news", label: "Novedades", icon: Megaphone, permission: "news:read" },
  { href: "/settings", label: "Ajustes", icon: Settings, permission: null },
];

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)).at(-1);
}

export function canAccess(permissions: readonly Permission[], item: NavItem): boolean {
  return item.permission === null || permissions.includes(item.permission);
}
