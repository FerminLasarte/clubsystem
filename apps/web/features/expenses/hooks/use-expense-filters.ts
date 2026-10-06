import type { ExpenseCategory } from "@clubsystem/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { ExpenseFilterQuery, PeriodQuery } from "@/features/expenses/api";
import { EXPENSE_CATEGORIES } from "@/features/expenses/labels";

export const PERIODS = ["day", "week", "month", "year", "range"] as const;
export type PeriodOption = (typeof PERIODS)[number];
export type ReviewedFilter = "all" | "pending" | "reviewed";

export interface ExpenseFilters {
  period: PeriodOption;
  from: string | null;
  to: string | null;
  category: ExpenseCategory | null;
  onlyAnomalies: boolean;
  reviewed: ReviewedFilter;
  page: number;
}

/** Cada cambio de filtro vuelve a la primera página. */
export type FilterPatch = Partial<Omit<ExpenseFilters, "page">> | { page: number };

function isOneOf<T extends string>(options: readonly T[], value: string | null): value is T {
  return value !== null && (options as readonly string[]).includes(value);
}

const REVIEWED: readonly ReviewedFilter[] = ["all", "pending", "reviewed"];

function parse(params: URLSearchParams): ExpenseFilters {
  const period = params.get("period");
  const category = params.get("category");
  const reviewed = params.get("reviewed");
  const page = Number(params.get("page"));
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  // Un rango sin fechas no es expresable en stats/export (caen al mes en curso): mejor mostrar el mes.
  const validPeriod = isOneOf(PERIODS, period) && (period !== "range" || from !== null || to !== null);
  return {
    period: validPeriod ? period : "month",
    from,
    to,
    category: isOneOf(EXPENSE_CATEGORIES, category) ? category : null,
    onlyAnomalies: params.get("anomalies") === "1",
    reviewed: isOneOf(REVIEWED, reviewed) ? reviewed : "all",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function serialize(filters: ExpenseFilters): string {
  const params = new URLSearchParams();
  if (filters.period !== "month") params.set("period", filters.period);
  if (filters.period === "range") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.onlyAnomalies) params.set("anomalies", "1");
  if (filters.reviewed !== "all") params.set("reviewed", filters.reviewed);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** Período tal como lo espera la API (siempre explícito: el listado no tiene default). */
export function toPeriodQuery(filters: ExpenseFilters): PeriodQuery {
  if (filters.period === "range") return { date_from: filters.from, date_to: filters.to };
  return { period: filters.period };
}

export function toFilterQuery(filters: ExpenseFilters): ExpenseFilterQuery {
  return {
    ...toPeriodQuery(filters),
    category: filters.category,
    has_anomaly: filters.onlyAnomalies ? true : null,
    reviewed: filters.reviewed === "all" ? null : filters.reviewed === "reviewed",
  };
}

/** Filtros y página de la pantalla de gastos, guardados en la URL. */
export function useExpenseFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => parse(new URLSearchParams(searchParams.toString())), [searchParams]);

  const setFilters = useCallback(
    (patch: FilterPatch) => {
      const next: ExpenseFilters = { ...filters, page: 1, ...patch };
      const search = serialize(next);
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  return { filters, setFilters };
}
