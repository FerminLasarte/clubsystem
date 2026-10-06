import type { ExpenseCategory } from "@clubsystem/api";
import { useCallback, useMemo } from "react";

import type { ExpenseFilterQuery, PeriodQuery } from "@/features/expenses/api";
import { EXPENSE_CATEGORIES } from "@/features/expenses/labels";
import { isOneOf, pageParam, useUrlParams, type UrlParamValue } from "@/lib/use-url-params";

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

const REVIEWED: readonly ReviewedFilter[] = ["all", "pending", "reviewed"];

function parse(params: { get: (key: string) => string | null }): ExpenseFilters {
  const period = params.get("period");
  const category = params.get("category");
  const reviewed = params.get("reviewed");
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  // Un rango sin fechas no es expresable en stats/export (caen al mes en curso): mejor mostrar el mes.
  const validPeriod = isOneOf(period, PERIODS) && (period !== "range" || from !== null || to !== null);
  return {
    period: validPeriod ? period : "month",
    from,
    to,
    category: isOneOf(category, EXPENSE_CATEGORIES) ? category : null,
    onlyAnomalies: params.get("anomalies") === "1",
    reviewed: isOneOf(reviewed, REVIEWED) ? reviewed : "all",
    page: pageParam(params),
  };
}

/** Parche completo de la URL: los valores por defecto no se escriben. */
function serialize(filters: ExpenseFilters): Record<string, UrlParamValue> {
  const isRange = filters.period === "range";
  return {
    period: filters.period === "month" ? null : filters.period,
    from: isRange ? filters.from : null,
    to: isRange ? filters.to : null,
    category: filters.category,
    anomalies: filters.onlyAnomalies ? "1" : null,
    reviewed: filters.reviewed === "all" ? null : filters.reviewed,
    page: filters.page > 1 ? filters.page : null,
  };
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
  const [params, setParams] = useUrlParams();
  const filters = useMemo(() => parse(params), [params]);

  const setFilters = useCallback(
    (patch: FilterPatch) => setParams(serialize({ ...filters, page: 1, ...patch })),
    [filters, setParams],
  );

  return { filters, setFilters };
}
