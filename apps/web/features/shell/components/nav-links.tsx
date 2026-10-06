"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useActiveSession } from "@/features/auth/api";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, canAccess, navItemFor } from "@/lib/navigation";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { permissions } = useActiveSession();
  const active = navItemFor(pathname);

  return (
    <nav aria-label="Secciones del panel" className="grid gap-1">
      {NAV_ITEMS.filter((item) => canAccess(permissions, item)).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={item === active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            item === active && "bg-accent font-medium text-foreground",
          )}
        >
          <item.icon className="size-4" aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
