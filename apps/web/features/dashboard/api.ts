import { unwrap } from "@clubsystem/api";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  operations: ["dashboard", "operations"] as const,
  finance: ["dashboard", "finance"] as const,
};

export function useDashboardOperations() {
  return useQuery({
    queryKey: dashboardKeys.operations,
    queryFn: () => unwrap(api.GET("/api/v1/admin/dashboard/operations")),
  });
}

/** Solo para roles con `dashboard:finance` (quien lo usa ya lo verificó). */
export function useDashboardFinance() {
  return useQuery({
    queryKey: dashboardKeys.finance,
    queryFn: () => unwrap(api.GET("/api/v1/admin/dashboard/finance")),
  });
}
