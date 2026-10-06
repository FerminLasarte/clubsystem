import type { MyReservationOut } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import { router } from "expo-router";

import { Badge, Card, Row, Text } from "@/shared/ui";

import { courtDescription, RESERVATION_STATUS_TONE, reservationDay, statusLabel, timeRange } from "../lib/format";

export function ReservationCard({ reservation: r }: { reservation: MyReservationOut }) {
  const day = reservationDay(r);
  const hours = timeRange(r.starts_at, r.ends_at, r.club.timezone);
  return (
    <Card
      onPress={() => router.push({ pathname: "/reservation/[id]", params: { id: r.id } })}
      accessibilityLabel={`Reserva del ${day}, ${hours}, ${r.court.name} en ${r.club.name}. ${statusLabel(r.status)}`}
    >
      <Row>
        <Text variant="subheading">{day}</Text>
        <Badge label={statusLabel(r.status)} tone={RESERVATION_STATUS_TONE[r.status]} />
      </Row>
      <Text variant="label">{hours}</Text>
      <Text color="muted">
        {r.court.name} · {r.club.name}
      </Text>
      <Row>
        <Text variant="caption" color="muted">
          {courtDescription(r.court)}
        </Text>
        <Text variant="label">{formatMoney(r.total_price)}</Text>
      </Row>
    </Card>
  );
}
