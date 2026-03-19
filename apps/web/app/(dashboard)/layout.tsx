"use client";
// apps/web/app/(dashboard)/layout.tsx
// Shell del Panel Admin — envuelve con ClubSessionProvider para RBAC multi-tenant.

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ClubSessionProvider } from "@/contexts/ClubSessionContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // ClubSessionProvider debe envolver TODA la shell para que Sidebar
    // pueda consumir useClubSession() sin prop-drilling.
    <ClubSessionProvider>
      <div className="flex h-screen bg-background font-sans antialiased">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            {/* Botón hamburguesa mobile — flotante sobre el contenido */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed left-4 top-4 z-30 rounded-lg p-2 bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer md:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            {children}
          </main>
        </div>
      </div>
    </ClubSessionProvider>
  );
}
