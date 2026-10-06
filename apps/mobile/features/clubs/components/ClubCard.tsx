import type { ClubDirectoryItemOut } from "@clubsystem/api";
import { SPORT_LABELS } from "@clubsystem/shared";

import { Badge, Button, Card, Row, Text } from "@/shared/ui";

import { canRequestMembership, MEMBERSHIP_STATUS_TONE, membershipLabel, requestLabel } from "../lib/status";

interface ClubCardProps {
  club: ClubDirectoryItemOut;
  onRequest: () => void;
  requesting: boolean;
  canRequest: boolean;
}

export function ClubCard({ club, onRequest, requesting, canRequest }: ClubCardProps) {
  const status = club.my_membership_status;
  const sports = club.sport_types.map((s) => SPORT_LABELS[s]).join(" · ");
  return (
    <Card>
      <Row>
        <Text variant="subheading">{club.name}</Text>
        {status ? <Badge label={membershipLabel(status)} tone={MEMBERSHIP_STATUS_TONE[status]} /> : null}
      </Row>
      {club.city ? <Text color="muted">{club.city}</Text> : null}
      {sports ? (
        <Text variant="caption" color="muted">
          {sports}
        </Text>
      ) : null}
      {canRequestMembership(status) ? (
        <Button
          title={requestLabel(status)}
          variant="secondary"
          onPress={onRequest}
          loading={requesting}
          disabled={!canRequest}
        />
      ) : null}
    </Card>
  );
}
