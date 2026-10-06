import type { CourtAvailabilityOut, SlotOut } from "@clubsystem/api";
import { formatDate, formatMoney } from "@clubsystem/shared";
import { StyleSheet, View } from "react-native";

import { PENDING_EXPLANATION, timeRange } from "@/features/reservations/lib/format";
import { Button, Notice, Row, Text } from "@/shared/ui";
import { colors, elevation, radius, spacing } from "@/shared/theme/tokens";

import { durationLabel } from "../lib/options";

interface BookingSummaryProps {
  clubName: string;
  court: CourtAvailabilityOut;
  slot: SlotOut;
  durationMinutes: number;
  timeZone: string;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Resumen fijo abajo con el turno elegido y la confirmación. */
export function BookingSummary(props: BookingSummaryProps) {
  const { court, slot, timeZone } = props;
  return (
    <View style={styles.panel}>
      <Row>
        <Text variant="subheading">
          {court.name} · {props.clubName}
        </Text>
        <Text variant="subheading">{formatMoney(court.price)}</Text>
      </Row>
      <Text>
        {formatDate(slot.starts_at, timeZone, { dateStyle: undefined, weekday: "long", day: "numeric", month: "long" })} ·{" "}
        {timeRange(slot.starts_at, slot.ends_at, timeZone)} ({durationLabel(props.durationMinutes)})
      </Text>
      <Notice tone="warning" message={`La reserva queda pendiente. ${PENDING_EXPLANATION}`} />
      <Button title="Confirmar reserva" onPress={props.onConfirm} loading={props.submitting} />
      <Button title="Elegir otro horario" variant="ghost" onPress={props.onCancel} disabled={props.submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...elevation.card,
  },
});
