import {
  unwrap,
  type MovementCreate,
  type StockItemCreate,
  type StockItemUpdate,
} from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const STOCK_PAGE_SIZE = 25;
export const MOVEMENTS_PAGE_SIZE = 20;

export interface StockFilters {
  search: string;
  category: string;
  lowStock: boolean;
}

const keys = {
  all: ["stock"] as const,
  items: (filters: StockFilters, page: number) => ["stock", "items", filters, page] as const,
  stats: ["stock", "stats"] as const,
  categories: ["stock", "categories"] as const,
  movements: (itemId: string, page: number) => ["stock", "movements", itemId, page] as const,
};

/** Filtros tal como los espera la API (los vacíos no se mandan). */
function filterQuery({ search, category, lowStock }: StockFilters) {
  return {
    search: search || undefined,
    category: category || undefined,
    low_stock: lowStock ? true : undefined,
  };
}

/** CSV del inventario con los mismos filtros que la tabla (para `ExportButton`). */
export function exportStockCsv(filters: StockFilters) {
  return api.GET("/api/v1/admin/stock/items/export.csv", { params: { query: filterQuery(filters) }, parseAs: "blob" });
}

export function useStockItems(filters: StockFilters, page: number) {
  return useQuery({
    queryKey: keys.items(filters, page),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/stock/items", {
          params: { query: { ...filterQuery(filters), page, page_size: STOCK_PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useStockStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => unwrap(api.GET("/api/v1/admin/stock/stats")) });
}

export function useStockCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => unwrap(api.GET("/api/v1/admin/stock/categories")) });
}

export function useStockMovements(itemId: string, page: number) {
  return useQuery({
    queryKey: keys.movements(itemId, page),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/stock/items/{item_id}/movements", {
          params: { path: { item_id: itemId }, query: { page, page_size: MOVEMENTS_PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Cualquier escritura cambia ítems, totales, categorías o historial: se invalida todo stock. */
function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

export function useCreateStockItem() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (body: StockItemCreate) => unwrap(api.POST("/api/v1/admin/stock/items", { body })),
    onSuccess: (item) => {
      void invalidate();
      toast.success(`"${item.name}" agregado al inventario`);
    },
    meta: { silent: true },
  });
}

export function useUpdateStockItem() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StockItemUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/stock/items/{item_id}", { params: { path: { item_id: id } }, body })),
    onSuccess: () => {
      void invalidate();
      toast.success("Ítem actualizado");
    },
    meta: { silent: true },
  });
}

export function useDeleteStockItem() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/stock/items/{item_id}", { params: { path: { item_id: id } } })),
    onSuccess: () => {
      void invalidate();
      toast.success("Ítem eliminado");
    },
  });
}

export function useCreateMovement() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: MovementCreate }) =>
      unwrap(
        api.POST("/api/v1/admin/stock/items/{item_id}/movements", { params: { path: { item_id: itemId } }, body }),
      ),
    onSuccess: () => {
      void invalidate();
      toast.success("Movimiento registrado");
    },
    meta: { silent: true },
  });
}
