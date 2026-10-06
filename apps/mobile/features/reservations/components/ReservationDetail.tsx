import { CANCEL_REASON_LABELS, formatDate, formatMoney } from "@clubsystem/shared";

import { durationLabel } from "@/features/booking/lib/options";
import { Badge, Card, Notice, QueryState, Row, Screen, Text } from "@/shared/ui";

import { useReservation } from "../hooks";
import { courtDescription, PENDING_EXPLANATION, RESERVATION_STATUS_TONE, statusLabel, timeRange } from "../lib/format";

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
        <Text variant="caption" color="muted">
          Desde la app no se pueden cancelar reservas: si necesitás cancelarla o cambiarla, comunicate con el club.
        </Text>
      </Card>
    </Screen>
  );
}
