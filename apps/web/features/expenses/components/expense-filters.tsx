"use client";

import type { ExpenseCategory } from "@clubsystem/api";
import { EXPENSE_CATEGORY_LABELS } from "@clubsystem/shared";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ExpenseFilters, FilterPatch, ReviewedFilter } from "@/features/expenses/hooks/use-expense-filters";
import { EXPENSE_CATEGORIES } from "@/features/expenses/labels";

const ALL = "all";

const REVIEWED_LABELS: Record<ReviewedFilter, string> = {
  all: "Todas",
  pending: "Sin revisar",
  reviewed: "Revisadas",
};

interface ExpenseFiltersBarProps {
  filters: ExpenseFilters;
  onChange: (patch: FilterPatch) => void;
}

export function ExpenseFiltersBar({ filters, onChange }: ExpenseFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="expenses-category">Categoría</Label>
        <Select
          value={filters.category ?? ALL}
          onValueChange={(value) => onChange({ category: value === ALL ? null : (value as ExpenseCategory) })}
        >
          <SelectTrigger id="expenses-category" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {EXPENSE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {EXPENSE_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expenses-reviewed">Revisión</Label>
        <Select value={filters.reviewed} onValueChange={(value) => onChange({ reviewed: value as ReviewedFilter })}>
          <SelectTrigger id="expenses-reviewed" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(REVIEWED_LABELS) as ReviewedFilter[]).map((option) => (
              <SelectItem key={option} value={option}>
                {REVIEWED_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Label className="h-8 font-normal">
        <Switch
          checked={filters.onlyAnomalies}
          onCheckedChange={(checked) => onChange({ onlyAnomalies: checked })}
        />
        Solo anomalías
      </Label>
    </div>
  );
}
