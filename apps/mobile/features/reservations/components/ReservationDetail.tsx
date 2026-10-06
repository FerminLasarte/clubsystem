import { errorMessage, type MyReservationOut } from "@clubsystem/api";
import { CANCEL_REASON_LABELS, formatDate, formatDateTime, formatMoney } from "@clubsystem/shared";
import { Alert } from "react-native";

import { durationLabel } from "@/features/booking/lib/options";
import { Badge, Button, Card, Notice, QueryState, Row, Screen, Text } from "@/shared/ui";

import { useCancelReservation, useReservation } from "../hooks";
import { courtDescription, PENDING_EXPLANATION, RESERVATION_STATUS_TONE, statusLabel, timeRange } from "../lib/format";

/** Texto bajo el precio: si se puede cancelar desde la app, y hasta cuándo. */
function cancelHint(r: MyReservationOut): string | null {
  if (r.status !== "pending" && r.status !== "confirmed") return null;
  if (!r.can_cancel) {
    return "Ya no se puede cancelar desde la app: si necesitás cancelarla o cambiarla, comunicate con el club.";
  }
  if (r.cancel_deadline) {
    return `Podés cancelarla desde la app hasta el ${formatDateTime(r.cancel_deadline, r.club.timezone)}.`;
  }
  return "Podés cancelarla mientras siga pendiente.";
}

function CancelButton({ reservation }: { reservation: MyReservationOut }) {
  const cancel = useCancelReservation();
  const onPress = () =>
    Alert.alert("Cancelar reserva", "¿Querés cancelar esta reserva? No se puede deshacer.", [
      { text: "Volver", style: "cancel" },
      {
        text: "Cancelar reserva",
        style: "destructive",
        onPress: () =>
          cancel.mutate(reservation, {
            onError: (error) => Alert.alert("No se pudo cancelar la reserva", errorMessage(error)),
          }),
      },
    ]);
  return <Button title="Cancelar reserva" variant="danger" onPress={onPress} loading={cancel.isPending} />;
}

export function ReservationDetail({ id }: { id: string }) {
  const query = useReservation(id);

  if (query.isPending || query.isError) {
    return (
      <Screen>
        <QueryState query={query} />
      </Screen>
    );
  }

  const r = query.data;
  const tz = r.club.timezone;
  const hint = cancelHint(r);
  return (
    <Screen scroll edges={["bottom"]}>
      <Card>
        <Row>
          <Text variant="heading">{r.club.name}</Text>
          <Badge label={statusLabel(r.status)} tone={RESERVATION_STATUS_TONE[r.status]} />
        </Row>
        <Text variant="subheading">{formatDate(r.starts_at, tz, { dateStyle: "full" })}</Text>
        <Text variant="label">
          {timeRange(r.starts_at, r.ends_at, tz)} · {durationLabel(r.duration_minutes)}
        </Text>
      </Card>

      {r.status === "pending" ? <Notice tone="warning" title="Pendiente de confirmación" message={PENDING_EXPLANATION} /> : null}
      {r.status === "cancelled" && r.cancel_reason ? (
        <Notice tone="danger" message={CANCEL_REASON_LABELS[r.cancel_reason]} />
      ) : null}

      <Card>
        <Text variant="label">Cancha</Text>
        <Text>{r.court.name}</Text>
        <Text variant="caption" color="muted">
          {courtDescription(r.court)}
        </Text>
      </Card>

      <Card>
        <Row>
          <Text variant="label">Precio</Text>
          <Text variant="subheading">{formatMoney(r.total_price)}</Text>
        </Row>
        {hint ? (
          <Text variant="caption" color="muted">
            {hint}
          </Text>
        ) : null}
      </Card>

      {r.can_cancel ? <CancelButton reservation={r} /> : null}
    </Screen>
  );
}
