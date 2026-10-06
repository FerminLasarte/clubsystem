"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";

import { StateView } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError, useLogout, useSession } from "@/features/auth/api";
import { canAccess, navItemFor } from "@/lib/navigation";

import { ClubSwitcher } from "./club-switcher";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 py-4">
      <ClubSwitcher />
      <div className="flex-1 overflow-y-auto px-2">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <UserMenu />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const logout = useLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (session.isPending) {
    return (
      <div className="flex min-h-svh">
        <Skeleton className="hidden w-64 md:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (session.isError) {
    const noAccess = isApiError(session.error) && session.error.status === 403;
    return (
      <StateView
        variant="error"
        title={noAccess ? "No tenés acceso a este club" : "No pudimos cargar tu sesión"}
        description={noAccess ? session.error.message : undefined}
        action={
          noAccess
            ? { label: "Cerrar sesión", onClick: () => logout.mutate() }
            : { label: "Reintentar", onClick: () => session.refetch() }
        }
        fullScreen
      />
    );
  }

  const { active_club, permissions } = session.data;
  const brand = {
    "--club-primary": active_club.primary_color,
    "--club-accent": active_club.accent_color,
  } as CSSProperties;
  const route = navItemFor(pathname);
  const allowed = !route || canAccess(permissions, route);

  return (
    <div style={brand} className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-card md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-card px-4 py-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="truncate font-semibold">{active_club.name}</span>
        </header>
        <main className="flex-1 p-4 md:p-8">
          {allowed ? (
            children
          ) : (
            <StateView
              variant="error"
              title="Sin permiso"
              description="Tu rol en este club no tiene acceso a esta sección."
            />
          )}
        </main>
      </div>
    </div>
  );
}
