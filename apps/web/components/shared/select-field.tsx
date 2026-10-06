"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  /** Valor → texto visible (por ejemplo los `*_LABELS` de @clubsystem/shared). */
  options: Readonly<Record<T, string>>;
  /** Con `name` el valor viaja en el FormData del form que lo contiene. */
  name?: string;
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  hideLabel?: boolean;
  className?: string;
}

/** Select con label asociado (análogo a FormField). */
export function SelectField<T extends string>({
  id,
  label,
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  hideLabel,
  className,
}: SelectFieldProps<T>) {
  const entries = Object.entries(options) as [T, string][];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <Select
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => onValueChange?.(next as T)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
