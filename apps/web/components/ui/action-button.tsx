// components/ui/action-button.tsx
//
// Botones de cabecera estandarizados. Patrón idéntico a reservations/page.tsx.
//
// Uso:
//   <ActionButton icon={Plus} onClick={...}>Nuevo gasto</ActionButton>
//   <ActionButton variant="outline" onClick={...}>...</ActionButton>
//   <ActionButton variant="destructive" icon={Minus} onClick={...}>Retiro</ActionButton>

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "destructive";

interface ActionButtonProps extends React.ComponentProps<"button"> {
  icon?: LucideIcon;
  variant?: Variant;
}

export function ActionButton({
  icon: Icon,
  children,
  variant = "primary",
  className,
  style,
  ...props
}: ActionButtonProps) {
  // ── Primary (brand) ──────────────────────────────────────────────────────
  if (variant === "primary") {
    return (
      <button
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        style={{ backgroundColor: "var(--color-brand)", ...style }}
        {...props}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </button>
    );
  }

  // ── Outline (secondary / export) ─────────────────────────────────────────
  if (variant === "outline") {
    return (
      <button
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        style={style}
        {...props}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </button>
    );
  }

  // ── Destructive (retiro / danger) ────────────────────────────────────────
  return (
    <button
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={style}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
