"use client";
// apps/web/app/(dashboard)/settings/_components/FieldInput.tsx

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label:       string;
  id:          string;
  hint?:       string;
  colSpan?:    "full" | "auto";
  leftSlot?:   React.ReactNode;
  rightSlot?:  React.ReactNode;
}

const INPUT_BASE =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm " +
  "text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition";

export function FieldInput({
  label,
  id,
  hint,
  colSpan,
  leftSlot,
  rightSlot,
  className,
  ...props
}: FieldInputProps) {
  return (
    <div className={cn("space-y-1.5", colSpan === "full" && "sm:col-span-2")}>
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wide text-gray-400"
      >
        {label}
      </label>

      <div className="relative">
        {leftSlot && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftSlot}
          </span>
        )}

        <input
          id={id}
          className={cn(
            INPUT_BASE,
            leftSlot  && "pl-9",
            rightSlot && "pr-10",
            className,
          )}
          {...props}
        />

        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightSlot}
          </span>
        )}
      </div>

      {hint && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}
