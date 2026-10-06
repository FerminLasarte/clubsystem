"use client";

import { todayIn } from "@clubsystem/shared";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveSession } from "@/features/auth/api";
import {
  PERIODS,
  type ExpenseFilters,
  type FilterPatch,
  type PeriodOption,
} from "@/features/expenses/hooks/use-expense-filters";
import { PERIOD_LABELS } from "@/features/expenses/labels";

interface PeriodSelectorProps {
  filters: ExpenseFilters;
  onChange: (patch: FilterPatch) => void;
}

export function PeriodSelector({ filters, onChange }: PeriodSelectorProps) {
  const { active_club } = useActiveSession();

  /** Al pasar a rango arrancamos con el mes en curso (en la zona del club). */
  function periodPatch(period: PeriodOption): FilterPatch {
    if (period !== "range" || filters.from || filters.to) return { period };
    const today = todayIn(active_club.timezone);
    return { period, from: `${today.slice(0, 8)}01`, to: today };
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="expenses-period">Período</Label>
        <Select value={filters.period} onValueChange={(value) => onChange(periodPatch(value as PeriodOption))}>
          <SelectTrigger id="expenses-period" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((period) => (
              <SelectItem key={period} value={period}>
                {PERIOD_LABELS[period]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filters.period === "range" ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="expenses-from">Desde</Label>
            <Input
              id="expenses-from"
              type="date"
              value={filters.from ?? ""}
              max={filters.to ?? undefined}
              onChange={(event) => onChange({ from: event.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="expenses-to">Hasta</Label>
            <Input
              id="expenses-to"
              type="date"
              value={filters.to ?? ""}
              min={filters.from ?? undefined}
              onChange={(event) => onChange({ to: event.target.value || null })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
