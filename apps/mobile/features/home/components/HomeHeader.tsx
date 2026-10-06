import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { EmailVerificationNotice } from "@/features/auth/components/EmailVerificationNotice";
import { useSession } from "@/features/auth/hooks";
import { approvedMemberships, useMyMemberships } from "@/features/clubs/hooks";
import { ReservationCard } from "@/features/reservations/components/ReservationCard";
import { useUpcomingReservations } from "@/features/reservations/hooks";
import { Button, Card, QueryState, Row, Text } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

export const HOME_UPCOMING_LIMIT = 3;

function MembershipCallout() {
  const memberships = useMyMemberships();
  if (memberships.isPending || memberships.isError) return <QueryState query={memberships} />;
  if (approvedMemberships(memberships.data).length > 0) return null;

  const pending = memberships.data.filter((m) => m.status === "PENDING");
  return (
    <Card>
      <Text variant="subheading">Todavía no sos socio de ningún club</Text>
      <Text color="muted">
        {pending.length > 0
          ? `Tu solicitud en ${pending.map((m) => m.club.name).join(", ")} está pendiente. Cuando el club la apruebe vas a poder reservar.`
          : "Buscá tu club y pedí ser socio para reservar canchas y ver sus novedades."}
      </Text>
      <Button title="Explorar clubes" onPress={() => router.navigate("/explore")} />
    </Card>
  );
}

function UpcomingReservations() {
  const upcoming = useUpcomingReservations(HOME_UPCOMING_LIMIT);
  return (
    <View style={styles.section}>
      <Row>
        <Text variant="heading">Próximas reservas</Text>
        <Button title="Ver todas" variant="ghost" onPress={() => router.navigate("/reservations")} />
      </Row>
      {upcoming.isPending || upcoming.isError ? (
        <QueryState query={upcoming} />
      ) : upcoming.data.items.length === 0 ? (
        <Card>
          <Text color="muted">No tenés reservas próximas.</Text>
          <Button title="Reservar una cancha" variant="secondary" onPress={() => router.navigate("/book")} />
        </Card>
      ) : (
        upcoming.data.items.map((r) => <ReservationCard key={r.id} reservation={r} />)
      )}
    </View>
  );
}

export function HomeHeader() {
  const firstName = useSession().data?.user.first_name;
  return (
    <View style={styles.section}>
      <Text variant="title">{firstName ? `Hola, ${firstName}` : "Hola"}</Text>
      <EmailVerificationNotice />
      <MembershipCallout />
      <UpcomingReservations />
      <Text variant="heading">Novedades</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
});
