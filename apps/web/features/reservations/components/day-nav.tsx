"use client";

import { formatDay, shiftDay } from "@clubsystem/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DayNavProps {
  day: string;
  today: string;
  onChange: (day: string) => void;
}

export function DayNav({ day, today, onChange }: DayNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => onChange(shiftDay(day, -1))}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button variant="outline" disabled={day === today} onClick={() => onChange(today)}>
        Hoy
      </Button>
      <Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => onChange(shiftDay(day, 1))}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      <Label htmlFor="grid-day" className="sr-only">
        Fecha
      </Label>
      <Input
        id="grid-day"
        type="date"
        value={day}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="w-auto"
      />
      <p className="text-sm font-medium first-letter:uppercase" aria-live="polite">
        {formatDay(day, { dateStyle: "full" })}
      </p>
    </div>
  );
}
