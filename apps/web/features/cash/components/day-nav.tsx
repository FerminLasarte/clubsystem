"use client";

import { isIsoDay, shiftDay } from "@clubsystem/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DayNavProps {
  date: string;
  today: string;
  onChange: (date: string) => void;
}

/** Anterior / siguiente / hoy y salto a una fecha. No se navega a días futuros. */
export function DayNav({ date, today, onChange }: DayNavProps) {
  const isToday = date >= today;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => onChange(shiftDay(date, -1))}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button variant="outline" onClick={() => onChange(today)} disabled={isToday}>
        Hoy
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Día siguiente"
        disabled={isToday}
        onClick={() => onChange(shiftDay(date, 1))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      <Label htmlFor="cash-date" className="sr-only">
        Ir a la fecha
      </Label>
      <Input
        id="cash-date"
        type="date"
        className="w-auto"
        value={date}
        max={today}
        onChange={(event) => {
          if (isIsoDay(event.target.value)) onChange(event.target.value);
        }}
      />
    </div>
  );
}
