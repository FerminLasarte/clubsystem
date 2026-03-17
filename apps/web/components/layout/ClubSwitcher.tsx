"use client";
// apps/web/components/layout/ClubSwitcher.tsx
//
// Dropdown en el TopBar para cambiar de club activo.
// Solo se renderiza si el operador pertenece a más de un club.
// Consiste en: botón trigger con nombre del club + lista desplegable de clubs.

import { useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClubSession } from "@/contexts/ClubSessionContext";
import { ROLE_LABELS } from "@clubsync/types";
import type { StaffClub } from "@clubsync/types";

export function ClubSwitcher() {
  const { activeClub, availableClubs, switchClub, isLoading } = useClubSession();
  const [isOpen, setIsOpen]       = useState(false);
  const [switching, setSwitching] = useState(false);

  // No renderizar si solo hay un club (sin nada que switchear)
  if (!activeClub || availableClubs.length <= 1) return null;

  async function handleSelect(club: StaffClub) {
    if (club.clubId === activeClub?.clubId) {
      setIsOpen(false);
      return;
    }
    try {
      setSwitching(true);
      await switchClub(club.clubId);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        disabled={switching || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card",
          "px-3 py-1.5 text-sm font-medium text-foreground transition-colors",
          "hover:bg-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          isOpen && "bg-accent",
        )}
      >
        {switching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="max-w-[140px] truncate">{activeClub.clubName}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop para cerrar al hacer click fuera */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setIsOpen(false)}
          />

          <ul
            role="listbox"
            aria-label="Seleccionar club"
            className={cn(
              "absolute right-0 top-full z-20 mt-1.5 min-w-[240px] overflow-hidden",
              "rounded-xl border border-border bg-card shadow-lg ring-1 ring-black/5",
            )}
          >
            {/* Header */}
            <li className="border-b border-border px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tus clubs
              </p>
            </li>

            {/* Club list */}
            {availableClubs.map((club) => {
              const isActive = club.clubId === activeClub.clubId;
              const initials = club.clubName.slice(0, 2).toUpperCase();

              return (
                <li key={club.clubId}>
                  <button
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(club)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer",
                      isActive
                        ? "bg-accent"
                        : "hover:bg-accent",
                    )}
                  >
                    {/* Avatar del club */}
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: club.primaryColor }}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {club.clubName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[club.role] ?? club.role}
                      </p>
                    </div>

                    {/* Check activo */}
                    {isActive && (
                      <Check className="h-4 w-4 flex-shrink-0 text-foreground" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
