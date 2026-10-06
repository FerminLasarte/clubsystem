import { unwrap, type FeeGenerateRequest, type FeeStatus, type PaymentMethod } from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateLedger } from "@/features/cash/api";
import { dashboardKeys } from "@/features/dashboard/api";
import { api } from "@/lib/api";

export const FEES_PAGE_SIZE = 25;

export interface FeeFilters {
  year: number;
  month: number;
  status: FeeStatus | null;
  search: string;
  page: number;
}

export const feesKeys = {
  all: ["fees"] as const,
  list: (filters: FeeFilters) => ["fees", "list", filters] as const,
  summary: (year: number, month: number) => ["fees", "summary", year, month] as const,
};

/** CSV de las cuotas de un mes (para `ExportButton`). */
export function exportFeesCsv(year: number, month: number) {
  return api.GET("/api/v1/admin/fees/export.csv", { params: { query: { year, month } }, parseAs: "blob" });
}

/** Cambios que no tocan la caja (generar, anular): cuotas y dashboard. */
function invalidateFees(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: feesKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

export function useFees(filters: FeeFilters) {
  return useQuery({
    queryKey: feesKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/fees", {
          params: {
            query: {
              year: filters.year,
              month: filters.month,
              status: filters.status,
              search: filters.search.trim() || null,
              page: filters.page,
              page_size: FEES_PAGE_SIZE,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useFeesSummary(year: number, month: number) {
  return useQuery({
    queryKey: feesKeys.summary(year, month),
    queryFn: () => unwrap(api.GET("/api/v1/admin/fees/summary", { params: { query: { year, month } } })),
  });
}

export function useGenerateFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: FeeGenerateRequest) => unwrap(api.POST("/api/v1/admin/fees/generate", { body })),
    onSuccess: () => {
      invalidateFees(queryClient);
    },
    meta: { silent: true },
  });
}

/** Cobrar crea un ingreso en caja. */
export function usePayFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: PaymentMethod }) =>
      unwrap(api.POST("/api/v1/admin/fees/{fee_id}/pay", { params: { path: { fee_id: id } }, body: { method } })),
    onSuccess: (fee) => {
      invalidateLedger(queryClient);
      toast.success(`Cuota de ${fee.member_name} cobrada`);
    },
    meta: { silent: true },
  });
}

export function useCancelFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/admin/fees/{fee_id}/cancel", { params: { path: { fee_id: id } } })),
    onSuccess: (fee) => {
      invalidateFees(queryClient);
      toast.success(`Cuota de ${fee.member_name} anulada`);
    },
  });
}
