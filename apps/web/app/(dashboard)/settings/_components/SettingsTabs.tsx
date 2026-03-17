"use client";
// apps/web/app/(dashboard)/settings/_components/SettingsTabs.tsx

import { User, Building2, CreditCard, Bell, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabId } from "./types";

// ── Tab config ────────────────────────────────────────────────────────────────

interface TabConfig {
  id:    TabId;
  label: string;
  icon:  LucideIcon;
}

const TABS: TabConfig[] = [
  { id: "profile",       label: "Perfil",          icon: User        },
  { id: "club",          label: "Club",             icon: Building2   },
  { id: "payments",      label: "Pagos",            icon: CreditCard  },
  { id: "notifications", label: "Notificaciones",   icon: Bell        },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface SettingsTabsProps {
  activeTab:   TabId;
  onTabChange: (tab: TabId) => void;
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <nav
      aria-label="Secciones de ajustes"
      className="border-b border-gray-100"
    >
      {/* Scrollable on mobile, full-width on desktop */}
      <ul
        role="tablist"
        className="-mb-px flex overflow-x-auto scrollbar-thin"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;

          return (
            <li key={id} role="presentation">
              <button
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                onClick={() => onTabChange(id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3",
                  "text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2",
                  active
                    ? "border-current text-accent"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {/* Full label on ≥sm, abbreviated on xs */}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
