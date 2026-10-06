"use client";

import { pageParam, useUrlParams } from "@/lib/use-url-params";

import type { StockFilters } from "./api";

/** Filtros y página del listado de stock, guardados en la URL. */
export function useStockFilters() {
  const [params, setParams] = useUrlParams();
  const filters: StockFilters = {
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
    lowStock: params.get("low_stock") === "true",
  };

  return {
    filters,
    page: pageParam(params),
    setPage: (page: number) => setParams({ page: page > 1 ? page : null }),
    /** Cambiar un filtro vuelve a la primera página. */
    setFilters: (changes: Partial<StockFilters>) =>
      setParams({
        ...(changes.search !== undefined && { search: changes.search }),
        ...(changes.category !== undefined && { category: changes.category }),
        ...(changes.lowStock !== undefined && { low_stock: changes.lowStock ? "true" : null }),
        page: null,
      }),
  };
}
