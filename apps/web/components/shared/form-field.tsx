import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Input con label asociado (accesible) y texto de ayuda opcional.
 * `className` se aplica al contenedor (p. ej. `sm:col-span-2` en una grilla); el resto de props, al input.
 */
export function FormField({ id, label, hint, className, ...props }: FormFieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
