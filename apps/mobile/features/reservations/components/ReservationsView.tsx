import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { useRefreshOnFocus } from "@/shared/hooks/useRefreshOnFocus";
import { Chip, PullToRefresh, QueryState, Row, screenContent, StateView } from "@/shared/ui";
import { colors, spacing } from "@/shared/theme/tokens";

import type { ReservationScope } from "../api";
import { useMyReservations } from "../hooks";
import { ReservationCard } from "./ReservationCard";

const SCOPES: { value: ReservationScope; label: string }[] = [
  { value: "upcoming", label: "Próximas" },
  { value: "past", label: "Pasadas" },
];

export function ReservationsView() {
  const [scope, setScope] = useState<ReservationScope>("upcoming");
  const query = useMyReservations(scope);
  useRefreshOnFocus(query.refetch);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Row justify="start">
          {SCOPES.map((s) => (
            <Chip key={s.value} label={s.label} selected={scope === s.value} onPress={() => setScope(s.value)} />
          ))}
        </Row>
      </View>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ReservationCard reservation={item} />}
        contentContainerStyle={screenContent.padded}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={<PullToRefresh onRefresh={query.refetch} />}
        ListEmptyComponent={
          query.isPending || query.isError ? (
            <QueryState query={query} />
          ) : scope === "upcoming" ? (
            <StateView
              kind="empty"
              title="No tenés reservas próximas"
              description="Elegí un club, un día y un horario libre."
              action={{ title: "Reservar", onPress: () => router.navigate("/book") }}
            />
          ) : (
            <StateView kind="empty" title="Todavía no tenés reservas pasadas" />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} />
          ) : query.isFetchNextPageError ? (
            <StateView kind="error" error={query.error} onRetry={() => void query.fetchNextPage()} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
