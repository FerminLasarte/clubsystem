"use client";
// apps/web/app/(dashboard)/layout.tsx
// Shell del Panel Admin — envuelve con ClubSessionProvider para RBAC multi-tenant.

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ClubSessionProvider } from "@/contexts/ClubSessionContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // ClubSessionProvider debe envolver TODA la shell para que Sidebar y TopBar
    // puedan consumir useClubSession() sin prop-drilling.
    <ClubSessionProvider>
      <div className="flex h-screen bg-background font-sans antialiased">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </ClubSessionProvider>
  );
}
