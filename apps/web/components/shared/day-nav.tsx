"use client";

import { formatDay, isIsoDay, shiftDay } from "@clubsystem/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DayNavProps {
  /** Día mostrado, "YYYY-MM-DD" en la zona del club. */
  day: string;
  today: string;
  onChange: (day: string) => void;
  /** false: no deja avanzar más allá de hoy (p. ej. caja). */
  allowFuture?: boolean;
  /** Muestra el día en texto largo al lado de los controles. */
  showLabel?: boolean;
}

/** Anterior / hoy / siguiente y salto a una fecha. */
export function DayNav({ day, today, onChange, allowFuture = true, showLabel = false }: DayNavProps) {
  const inputId = useId();
  const atLimit = !allowFuture && day >= today;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => onChange(shiftDay(day, -1))}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button variant="outline" disabled={day === today} onClick={() => onChange(today)}>
        Hoy
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Día siguiente"
        disabled={atLimit}
        onClick={() => onChange(shiftDay(day, 1))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      <Label htmlFor={inputId} className="sr-only">
        Ir a la fecha
      </Label>
      <Input
        id={inputId}
        type="date"
        className="w-auto"
        value={day}
        max={allowFuture ? undefined : today}
        onChange={(event) => {
          if (isIsoDay(event.target.value)) onChange(event.target.value);
        }}
      />
      {showLabel ? (
        <p className="text-sm font-medium first-letter:uppercase" aria-live="polite">
          {formatDay(day, { dateStyle: "full" })}
        </p>
      ) : null}
    </div>
  );
}
