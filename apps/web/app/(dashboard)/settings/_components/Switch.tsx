"use client";
// apps/web/app/(dashboard)/settings/_components/Switch.tsx

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked:          boolean;
  onCheckedChange:  (checked: boolean) => void;
  id?:              string;
  disabled?:        boolean;
  "aria-label"?:    string;
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled = false,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "bg-gray-200",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white",
          "shadow-[0_1px_3px_rgb(0,0,0,0.18)] ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
