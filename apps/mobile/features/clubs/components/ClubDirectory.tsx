import { useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { EmailVerificationNotice } from "@/features/auth/components/EmailVerificationNotice";
import { useSession } from "@/features/auth/hooks";
import { errorMessage } from "@/shared/api/errors";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useRefreshOnFocus } from "@/shared/hooks/useRefreshOnFocus";
import { Input, PullToRefresh, QueryState, screenContent, StateView } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

import { useClubsDirectory, useRequestMembership } from "../hooks";
import { ClubCard } from "./ClubCard";

export function ClubDirectory() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const query = useClubsDirectory(debounced);
  const request = useRequestMembership();
  const emailVerified = useSession().data?.user.email_verified ?? false;
  useRefreshOnFocus(query.refetch);

  const requestMembership = (clubId: string, clubName: string) =>
    request.mutate(clubId, {
      onSuccess: (membership) =>
        membership.status === "APPROVED"
          ? Alert.alert("¡Listo!", `Ya sos socio de ${clubName}.`)
          : Alert.alert("Solicitud enviada", `${clubName} va a revisar tu solicitud. Vas a ver el estado en esta pantalla.`),
      onError: (error) => Alert.alert("No se pudo enviar la solicitud", errorMessage(error)),
    });

  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={screenContent.padded}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Input
            label="Buscar club"
            value={search}
            onChangeText={setSearch}
            placeholder="Nombre o ciudad"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <EmailVerificationNotice />
        </View>
      }
      renderItem={({ item }) => (
        <ClubCard
          club={item}
          canRequest={emailVerified && !request.isPending}
          requesting={request.isPending && request.variables === item.id}
          onRequest={() => requestMembership(item.id, item.name)}
        />
      )}
      refreshControl={<PullToRefresh onRefresh={query.refetch} />}
      ListEmptyComponent={
        query.isPending || query.isError ? (
          <QueryState query={query} />
        ) : (
          <StateView
            kind="empty"
            title={debounced ? "No encontramos clubes con esa búsqueda" : "Todavía no hay clubes disponibles"}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
  },
});
