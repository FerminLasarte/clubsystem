"use client";

import { pageFromParams, useQueryParams } from "@/lib/use-query-params";

import type { StockFilters } from "./api";

/** Filtros y página del listado de stock, guardados en la URL. */
export function useStockFilters() {
  const { params, set } = useQueryParams();
  const filters: StockFilters = {
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
    lowStock: params.get("low_stock") === "true",
  };

  return {
    filters,
    page: pageFromParams(params),
    setPage: (page: number) => set({ page: page > 1 ? String(page) : null }),
    /** Cambiar un filtro vuelve a la primera página. */
    setFilters: (changes: Partial<StockFilters>) =>
      set({
        ...(changes.search !== undefined && { search: changes.search }),
        ...(changes.category !== undefined && { category: changes.category }),
        ...(changes.lowStock !== undefined && { low_stock: changes.lowStock ? "true" : null }),
        page: null,
      }),
  };
}
