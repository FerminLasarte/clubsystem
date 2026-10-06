import type { AnomalySeverity, ExpenseCategory } from "@clubsystem/api";
import { EXPENSE_CATEGORY_LABELS } from "@clubsystem/shared";

import type { PeriodOption } from "@/features/expenses/hooks/use-expense-filters";

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export const PERIOD_LABELS: Record<PeriodOption, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
  range: "Rango de fechas",
};

export const SEVERITY_TONES: Record<AnomalySeverity, string> = {
  low: "bg-info/10 text-info",
  medium: "bg-warning/15 text-warning-foreground",
  high: "bg-destructive/10 text-destructive",
  critical: "border-destructive bg-destructive/20 text-destructive",
};
