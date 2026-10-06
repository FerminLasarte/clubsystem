import type { MyMembershipOut } from "@clubsystem/api";
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage } from "@/shared/api/errors";
import { Button, Card, Row, Text } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

import { pendingInvitations, useAcceptInvitation, useDeclineInvitation, useMyMemberships } from "../hooks";

function InvitationCard({ invitation }: { invitation: MyMembershipOut }) {
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const busy = accept.isPending || decline.isPending;
  const club = invitation.club.name;

  const onAccept = () =>
    accept.mutate(invitation.id, {
      onSuccess: () => Alert.alert("¡Bienvenido!", `Ya sos socio de ${club}.`),
      onError: (error) => Alert.alert("No se pudo aceptar la invitación", errorMessage(error)),
    });

  const onDecline = () =>
    Alert.alert("Rechazar invitación", `¿Querés rechazar la invitación de ${club}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar",
        style: "destructive",
        onPress: () =>
          decline.mutate(invitation.id, {
            onError: (error) => Alert.alert("No se pudo rechazar la invitación", errorMessage(error)),
          }),
      },
    ]);

  return (
    <Card>
      <Text variant="subheading">{club} te invitó a ser socio</Text>
      {invitation.plan ? (
        <Text variant="caption" color="muted">
          Plan {invitation.plan.name}
        </Text>
      ) : null}
      <Row>
        <View style={styles.action}>
          <Button title="Rechazar" variant="secondary" onPress={onDecline} disabled={busy} loading={decline.isPending} />
        </View>
        <View style={styles.action}>
          <Button title="Aceptar" onPress={onAccept} disabled={busy} loading={accept.isPending} />
        </View>
      </Row>
    </Card>
  );
}

/** Invitaciones de clubes pendientes de respuesta (no muestra nada si no hay). */
export function InvitationsList() {
  const invitations = pendingInvitations(useMyMemberships().data);
  if (invitations.length === 0) return null;
  return (
    <View style={styles.list}>
      {invitations.map((m) => (
        <InvitationCard key={m.id} invitation={m} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
