import type { MyMembershipOut } from "@clubsystem/api";
import { formatMoney, MEMBERSHIP_STATUS_LABELS } from "@clubsystem/shared";

import { Badge, Card, Row, Text } from "@/shared/ui";

import { MEMBERSHIP_STATUS_TONE } from "../lib/status";

export function MembershipCard({ membership: m }: { membership: MyMembershipOut }) {
  const details = [
    m.member_number ? `Socio n.º ${m.member_number}` : null,
    m.plan ? `${m.plan.name} · ${formatMoney(m.plan.monthly_fee)}/mes` : null,
  ].filter(Boolean);
  return (
    <Card>
      <Row>
        <Text variant="subheading">{m.club.name}</Text>
        <Badge label={MEMBERSHIP_STATUS_LABELS[m.status]} tone={MEMBERSHIP_STATUS_TONE[m.status]} />
      </Row>
      {m.club.city ? <Text color="muted">{m.club.city}</Text> : null}
      {details.length > 0 ? (
        <Text variant="caption" color="muted">
          {details.join(" · ")}
        </Text>
      ) : null}
    </Card>
  );
}
