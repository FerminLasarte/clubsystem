import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl } from "react-native";

import { authKeys } from "@/features/auth/api";
import { clubKeys } from "@/features/clubs/api";
import { newsKeys } from "@/features/news/api";
import { NewsCard } from "@/features/news/components/NewsCard";
import { useMyNews } from "@/features/news/hooks";
import { reservationKeys } from "@/features/reservations/api";
import { useRefreshOnFocus } from "@/shared/hooks/useRefreshOnFocus";
import { QueryState, screenContent, StateView } from "@/shared/ui";
import { colors } from "@/shared/theme/tokens";

import { HOME_UPCOMING_LIMIT, HomeHeader } from "./HomeHeader";

const HOME_QUERIES = [
  authKeys.session,
  clubKeys.memberships,
  reservationKeys.upcomingPreview(HOME_UPCOMING_LIMIT),
  newsKeys.mine,
];

export function HomeView() {
  const queryClient = useQueryClient();
  const news = useMyNews();
  const [refreshing, setRefreshing] = useState(false);

  // Inicio junta sesión, membresías, reservas y novedades.
  const refetchHome = useCallback(
    () => Promise.all(HOME_QUERIES.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" }))),
    [queryClient],
  );
  useRefreshOnFocus(refetchHome);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchHome();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      data={news.data ?? []}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => <NewsCard news={item} />}
      contentContainerStyle={screenContent.padded}
      ListHeaderComponent={<HomeHeader />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        news.isPending || news.isError ? (
          <QueryState query={news} />
        ) : (
          <StateView kind="empty" title="Sin novedades" description="Acá vas a ver lo que publiquen tus clubes." />
        )
      }
    />
  );
}
