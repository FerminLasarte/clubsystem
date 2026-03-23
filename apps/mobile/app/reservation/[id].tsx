/**
 * Detalle de Reserva
 * ===================
 * Recibe los datos de la reserva como params de Expo Router
 * (pasados desde la pantalla "Tus Reservas" al tocar un ticket).
 *
 * Muestra: cancha, deporte, fecha, horario, estado, precio e ID.
 */

import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui/Text";

// ── Helpers ───────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  tennis:     "Tenis",
  padel:      "Pádel",
  football:   "Fútbol",
  basketball: "Básquet",
  other:      "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
};

const STATUS_COLORS: Record<string, string> = {
  pending:   Colors.statusPending,
  confirmed: Colors.statusConfirmed,
  completed: Colors.statusCompleted,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Fila de detalle ───────────────────────────────────────────

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function DetailRow({
  icon,
  label,
  value,
}: {
  icon:  FeatherIconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Feather name={icon} size={15} color={Colors.textMuted} />
      </View>
      <View style={styles.detailContent}>
        <Text variant="label" muted>{label}</Text>
        <Text variant="body" weight="600" style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Pantalla ───────────────────────────────────────────────────

export default function ReservationDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    id,
    court_name,
    sport,
    starts_at,
    ends_at,
    status,
    total_price,
  } = useLocalSearchParams<{
    id:          string;
    court_name:  string;
    sport:       string;
    starts_at:   string;
    ends_at:     string;
    status:      string;
    total_price: string;
  }>();

  const statusColor = STATUS_COLORS[status ?? ""] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[status ?? ""] ?? (status ?? "—");
  const sportLabel  = SPORT_LABELS[sport ?? ""]   ?? (sport ?? "—");
  const price       = parseFloat(total_price ?? "0");

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* ── Header con back ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text variant="subheading" weight="700" style={styles.headerTitle}>
          Detalle de Reserva
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banner de estado ── */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text variant="subheading" weight="700" style={{ color: statusColor }}>
            {statusLabel}
          </Text>
        </View>

        {/* ── Card principal ── */}
        <Card>
          <Text variant="heading" weight="700" style={styles.courtTitle} numberOfLines={2}>
            {court_name ?? "—"}
          </Text>
          <Text variant="body" muted style={styles.sportLabel}>{sportLabel}</Text>

          <View style={styles.divider} />

          <DetailRow
            icon="calendar"
            label="Fecha"
            value={starts_at ? formatDate(starts_at) : "—"}
          />
          <DetailRow
            icon="clock"
            label="Horario"
            value={
              starts_at && ends_at
                ? `${formatTime(starts_at)} – ${formatTime(ends_at)}`
                : "—"
            }
          />
          {price > 0 && (
            <DetailRow
              icon="tag"
              label="Total"
              value={`$${price.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
            />
          )}
          {id && (
            <DetailRow
              icon="hash"
              label="Código de reserva"
              value={id.slice(0, 8).toUpperCase()}
            />
          )}
        </Card>

        {/* ── Aviso para pendientes ── */}
        {status === "pending" && (
          <View style={styles.noticeBox}>
            <Feather name="info" size={15} color={Colors.statusPending} />
            <Text variant="caption" style={styles.noticeText}>
              Tu reserva está pendiente de confirmación por el administrador del club.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     12,
    gap:               12,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: Colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    color: Colors.text,
    flex:  1,
  },

  // ── Scroll ─────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 16,
    paddingTop:        8,
    gap:               12,
  },

  // ── Status banner ──────────────────────────────────────────
  statusBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    flexShrink:   0,
  },

  // ── Card ────────────────────────────────────────────────────
  courtTitle: {
    color:        Colors.text,
    marginBottom: 4,
  },
  sportLabel: {
    marginBottom: 16,
  },
  divider: {
    height:          1,
    backgroundColor: Colors.border,
    marginBottom:    16,
  },

  // ── Detail row ─────────────────────────────────────────────
  detailRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           12,
    marginBottom:  14,
  },
  detailIconWrap: {
    width:           32,
    height:          32,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  detailContent: {
    flex: 1,
    gap:  2,
  },
  detailValue: {
    color: Colors.text,
  },

  // ── Notice ─────────────────────────────────────────────────
  noticeBox: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            10,
    backgroundColor: Colors.warningSurface,
    borderRadius:   12,
    padding:        14,
    borderWidth:    1,
    borderColor:    Colors.statusPending + "30",
  },
  noticeText: {
    color:      Colors.statusPending,
    flex:       1,
    lineHeight: 18,
  },
});
