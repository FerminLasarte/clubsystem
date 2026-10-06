import { useState } from "react";
import { RefreshControl } from "react-native";

import { colors } from "@/shared/theme/tokens";

/**
 * RefreshControl que solo muestra el spinner cuando el usuario tira para refrescar
 * (los refetch en segundo plano, por foco o invalidación, no lo encienden).
 */
export function PullToRefresh({ onRefresh, ...props }: { onRefresh: () => Promise<unknown> }) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  return <RefreshControl {...props} refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />;
}
