import { router } from "expo-router";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { useLogout } from "@/features/auth/hooks";
import { MembershipCard } from "@/features/clubs/components/MembershipCard";
import { useMyMemberships } from "@/features/clubs/hooks";
import { useRefreshOnFocus } from "@/shared/hooks/useRefreshOnFocus";
import { Badge, Button, Card, QueryState, Row, screenContent, StateView, Text } from "@/shared/ui";
import { colors, spacing } from "@/shared/theme/tokens";

import { useProfile } from "../hooks";

function UserCard() {
  const profile = useProfile();
  if (profile.isPending || profile.isError) return <QueryState query={profile} />;
  const user = profile.data;
  return (
    <Card>
      <Text variant="heading">
        {user.first_name} {user.last_name}
      </Text>
      <Row>
        <Text color="muted">{user.email}</Text>
        <Badge
          label={user.email_verified ? "Verificado" : "Sin verificar"}
          tone={user.email_verified ? "success" : "warning"}
        />
      </Row>
      {user.dni ? <Text color="muted">DNI {user.dni}</Text> : null}
      {user.phone ? <Text color="muted">Tel. {user.phone}</Text> : null}
      <Button title="Editar datos" variant="secondary" onPress={() => router.push("/profile/edit")} />
    </Card>
  );
}

export function ProfileView() {
  const memberships = useMyMemberships();
  const logout = useLogout();
  useRefreshOnFocus(memberships.refetch);

  const confirmLogout = () =>
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta en este dispositivo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => logout.mutate() },
    ]);

  return (
    <FlatList
      data={memberships.data ?? []}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MembershipCard membership={item} />}
      contentContainerStyle={screenContent.padded}
      refreshControl={
        <RefreshControl
          refreshing={memberships.isRefetching}
          onRefresh={() => void memberships.refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.section}>
          <UserCard />
          <Text variant="heading">Mis membresías</Text>
        </View>
      }
      ListEmptyComponent={
        memberships.isPending || memberships.isError ? (
          <QueryState query={memberships} />
        ) : (
          <StateView
            kind="empty"
            title="No tenés membresías"
            action={{ title: "Explorar clubes", onPress: () => router.navigate("/explore") }}
          />
        )
      }
      ListFooterComponent={
        <View style={styles.section}>
          <Button title="Cambiar contraseña" variant="secondary" onPress={() => router.push("/profile/password")} />
          <Button title="Cerrar sesión" variant="danger" onPress={confirmLogout} loading={logout.isPending} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
});
