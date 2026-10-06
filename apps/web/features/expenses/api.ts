import { unwrap, type ExpenseCreate, type ExpenseOut, type ExpenseUpdate, type paths } from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export type ExpenseListQuery = NonNullable<paths["/api/v1/admin/expenses"]["get"]["parameters"]["query"]>;
export type ExpenseFilterQuery = Omit<ExpenseListQuery, "page" | "page_size">;
export type PeriodQuery = Pick<ExpenseListQuery, "period" | "date_from" | "date_to">;

const keys = {
  all: ["expenses"] as const,
  list: (query: ExpenseListQuery) => ["expenses", "list", query] as const,
  stats: (query: ExpenseFilterQuery) => ["expenses", "stats", query] as const,
  detail: (id: string) => ["expenses", "detail", id] as const,
};

/** Mientras el LLM redacta explicaciones en background, refrescamos cada tanto. */
const PENDING_REFETCH_MS = 15_000;

function hasPendingExplanation(expenses: readonly ExpenseOut[] | undefined): boolean {
  return expenses?.some((expense) => expense.explanation_status === "pending") ?? false;
}

export function useExpenses(query: ExpenseListQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: () => unwrap(api.GET("/api/v1/admin/expenses", { params: { query } })),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (hasPendingExplanation(q.state.data?.items) ? PENDING_REFETCH_MS : false),
  });
}

export function useExpenseStats(query: ExpenseFilterQuery) {
  return useQuery({
    queryKey: keys.stats(query),
    queryFn: () => unwrap(api.GET("/api/v1/admin/expenses/stats", { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

/** Detalle fresco de un gasto (el diálogo de anomalía). `seed` evita el parpadeo al abrir. */
export function useExpense(id: string, seed: ExpenseOut) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/expenses/{expense_id}", { params: { path: { expense_id: id } } })),
    placeholderData: seed,
    refetchInterval: (q) => (hasPendingExplanation(q.state.data ? [q.state.data] : []) ? PENDING_REFETCH_MS : false),
  });
}

/** URL del CSV del backend con los mismos filtros (la sesión viaja en la cookie). */
export function exportCsvUrl(query: ExpenseFilterQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return `/api/v1/admin/expenses/export.csv${search ? `?${search}` : ""}`;
}

function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (body: ExpenseCreate) => unwrap(api.POST("/api/v1/admin/expenses", { body })),
    onSuccess: () => {
      void invalidate();
      toast.success("Gasto registrado");
    },
    meta: { silent: true },
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/expenses/{expense_id}", { params: { path: { expense_id: id } }, body })),
    onSuccess: () => {
      void invalidate();
      toast.success("Gasto actualizado");
    },
    meta: { silent: true },
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/expenses/{expense_id}", { params: { path: { expense_id: id } } })),
    onSuccess: () => {
      void invalidate();
      toast.success("Gasto eliminado");
    },
  });
}

export function useReviewExpense() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.PATCH("/api/v1/admin/expenses/{expense_id}/review", { params: { path: { expense_id: id } } })),
    onSuccess: (expense) => {
      queryClient.setQueryData(keys.detail(expense.id), expense);
      void invalidate();
      toast.success("Anomalía marcada como revisada");
    },
  });
}

export function useRecomputeAnomalies() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (query: PeriodQuery) =>
      unwrap(api.POST("/api/v1/admin/expenses/anomalies/recompute", { params: { query } })),
    onSuccess: ({ analyzed, flagged }) => {
      void invalidate();
      toast.success("Anomalías recalculadas", {
        description: `${analyzed} gastos analizados · ${flagged} con anomalía`,
      });
    },
  });
}
