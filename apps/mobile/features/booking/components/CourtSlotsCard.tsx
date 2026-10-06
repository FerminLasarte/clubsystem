import type { CourtAvailabilityOut } from "@clubsystem/api";
import { formatMoney, formatTime } from "@clubsystem/shared";

import { courtDescription } from "@/features/reservations/lib/format";
import { Card, Chip, Row, Text } from "@/shared/ui";

interface CourtSlotsCardProps {
  court: CourtAvailabilityOut;
  timeZone: string;
  selectedStart: string | undefined;
  onSelect: (startsAt: string) => void;
}

/** Una cancha con sus inicios libres. El precio es el final para el socio, calculado por el backend. */
export function CourtSlotsCard({ court, timeZone, selectedStart, onSelect }: CourtSlotsCardProps) {
  return (
    <Card>
      <Row>
        <Text variant="subheading">{court.name}</Text>
        <Text variant="label">{formatMoney(court.price)}</Text>
      </Row>
      <Text variant="caption" color="muted">
        {courtDescription(court)}
      </Text>
      {court.slots.length === 0 ? (
        <Text color="muted">Sin turnos libres para ese día.</Text>
      ) : (
        <Row justify="start">
          {court.slots.map((slot) => {
            const time = formatTime(slot.starts_at, timeZone);
            return (
              <Chip
                key={slot.starts_at}
                label={time}
                accessibilityLabel={`${court.name} a las ${time}`}
                selected={slot.starts_at === selectedStart}
                onPress={() => onSelect(slot.starts_at)}
              />
            );
          })}
        </Row>
      )}
    </Card>
  );
}
