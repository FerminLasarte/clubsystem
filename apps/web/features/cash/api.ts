import { unwrap, type PaymentCreate } from "@clubsystem/api";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardKeys } from "@/features/dashboard/api";
import { api } from "@/lib/api";

export const cashKeys = {
  all: ["cash"] as const,
  day: (date: string) => ["cash", "day", date] as const,
};

/**
 * Todo lo que mueve plata afecta caja, cuotas (cobrar una crea un ingreso; anular ese ingreso la deja
 * pendiente) y el dashboard. "fees" es la clave raíz de cuotas (no se importa: cuotas depende de caja).
 */
export function invalidateLedger(queryClient: QueryClient) {
  for (const key of [cashKeys.all, ["fees"], dashboardKeys.all]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

/** CSV de movimientos de caja de un día (`from` = `to`) o de un rango (para `ExportButton`). */
export function exportCashCsv(from: string, to: string) {
  return api.GET("/api/v1/admin/cash/export.csv", { params: { query: { from, to } }, parseAs: "blob" });
}

export function useCashDay(date: string) {
  return useQuery({
    queryKey: cashKeys.day(date),
    queryFn: () => unwrap(api.GET("/api/v1/admin/cash/day", { params: { query: { date } } })),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentCreate) => unwrap(api.POST("/api/v1/admin/cash/payments", { body })),
    onSuccess: (movement) => {
      invalidateLedger(queryClient);
      toast.success(movement.type === "INCOME" ? "Ingreso registrado" : "Egreso registrado");
    },
    meta: { silent: true },
  });
}

export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        api.POST("/api/v1/admin/cash/payments/{payment_id}/void", {
          params: { path: { payment_id: id } },
          body: { reason },
        }),
      ),
    onSuccess: () => {
      invalidateLedger(queryClient);
      toast.success("Movimiento anulado");
    },
    meta: { silent: true },
  });
}
