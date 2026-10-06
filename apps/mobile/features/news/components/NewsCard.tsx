import type { MemberNewsOut } from "@clubsystem/api";
import { formatDate } from "@clubsystem/shared";
import { StyleSheet, View } from "react-native";

import { deviceTimeZone } from "@/shared/lib/time";
import { Badge, Card, Row, Text } from "@/shared/ui";
import { radius, spacing } from "@/shared/theme/tokens";

export function NewsCard({ news }: { news: MemberNewsOut }) {
  return (
    <Card>
      <Row>
        <Row justify="start">
          {/* Color de marca del club, que llega de la API. */}
          <View style={[styles.dot, { backgroundColor: news.club_color }]} />
          <Text variant="caption" color="muted">
            {news.club_name}
          </Text>
        </Row>
        {news.tag ? <Badge label={news.tag} /> : null}
      </Row>
      <Text variant="subheading">{news.title}</Text>
      <Text color="muted" numberOfLines={6}>
        {news.body}
      </Text>
      {/* La novedad no trae la zona del club: la fecha (solo el día) se muestra en la del dispositivo. */}
      <Text variant="caption" color="muted">
        {formatDate(news.created_at, news.club_timezone)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
});
