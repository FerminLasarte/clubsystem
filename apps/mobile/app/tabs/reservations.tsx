/**
 * Mis Reservas — Portal del Jugador
 * ===================================
 * Diseño ticket premium: cada reserva es un "billete" con barra lateral de estado,
 * nombre de cancha en bold grande, íconos de calendario y reloj alineados.
 *
 * Flujo:
 *   1. Al montar, llama a GET /api/v1/mobile/reservations/me (con Bearer JWT).
 *   2. Spinner mientras carga.
 *   3. Lista de tickets con pull-to-refresh.
 *   4. Estado vacío amigable.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui/Text";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/utils/api";

// ── Tipos ─────────────────────────────────────────────────────

interface ReservationMeOut {
  id:          string;
  court_name:  string;
  sport:       string;
  starts_at:   string;   // ISO 8601 UTC
  ends_at:     string;
  status:      "pending" | "confirmed" | "completed";
  total_price: number;
}

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
  const date = new Date(iso);
  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
  });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("es-AR", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Ticket de reserva ─────────────────────────────────────────

function ReservationTicket({ item, onPress }: { item: ReservationMeOut; onPress: () => void }) {
  const statusColor = STATUS_COLORS[item.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const sportLabel  = SPORT_LABELS[item.sport]   ?? item.sport;

  return (
    <Card padding={0} style={styles.ticketCard} onPress={onPress}>
      <View style={styles.ticketInner}>
        {/* Barra lateral de estado */}
        <View style={[styles.ticketAccent, { backgroundColor: statusColor }]} />

        <View style={styles.ticketBody}>
          {/* Fila superior: cancha + estado */}
          <View style={styles.ticketTop}>
            <Text variant="subheading" weight="700" style={styles.courtName} numberOfLines={1}>
              {item.court_name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
              <Text variant="label" style={{ color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>

          {/* Deporte */}
          <Text variant="caption" muted style={styles.sportLabel}>{sportLabel}</Text>

          {/* Fecha con ícono */}
          <View style={styles.infoRow}>
            <Feather name="calendar" size={12} color={Colors.textMuted} />
            <Text variant="caption" muted style={styles.infoText}>
              {formatDate(item.starts_at)}
            </Text>

            {/* Hora con ícono */}
            <Feather name="clock" size={12} color={Colors.textMuted} style={styles.infoIconGap} />
            <Text variant="caption" muted style={styles.infoText}>
              {formatTime(item.starts_at)} – {formatTime(item.ends_at)}
            </Text>
          </View>

          {/* Precio */}
          {item.total_price > 0 && (
            <Text variant="caption" weight="600" style={styles.price}>
              ${item.total_price.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

// ── Estado vacío ─────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Feather name="calendar" size={36} color={Colors.primary} />
      </View>
      <Text variant="heading" style={styles.emptyTitle}>Sin turnos próximos</Text>
      <Text variant="body" muted style={styles.emptyBody}>
        Cuando reserves una cancha, tus turnos aparecerán acá.
      </Text>
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
        <Text variant="caption" weight="600" style={styles.refreshBtnText}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Pantalla principal ─────────────────────────────────────────

export default function ReservationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reservations, setReservations] = useState<ReservationMeOut[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchReservations = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await apiClient.get<ReservationMeOut[]>("/mobile/reservations/me");
      setReservations(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al cargar reservas";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const renderItem: ListRenderItem<ReservationMeOut> = useCallback(
    ({ item }) => (
      <ReservationTicket
        item={item}
        onPress={() =>
          router.push({
            pathname: "/reservation/[id]",
            params: {
              id:          item.id,
              court_name:  item.court_name,
              sport:       item.sport,
              starts_at:   item.starts_at,
              ends_at:     item.ends_at,
              status:      item.status,
              total_price: String(item.total_price),
            },
          })
        }
      />
    ),
    [router]
  );

  const keyExtractor = useCallback((item: ReservationMeOut) => item.id, []);

  // ── Carga inicial ─────────────────────────────────────────

  // ── Pill con contador (se reutiliza en todos los estados) ──
  const countPill = reservations.length > 0 ? (
    <View style={styles.countPill}>
      <Text variant="label" style={styles.countText}>{reservations.length}</Text>
    </View>
  ) : undefined;

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />
        <PageHeader title="Tus Reservas" withSeparator />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────

  if (error) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />
        <PageHeader title="Tus Reservas" withSeparator />
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={Colors.danger} />
          <Text variant="heading" style={styles.errorTitle}>Algo salió mal</Text>
          <Text variant="body" muted style={styles.errorBody}>{error}</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchReservations()}
            activeOpacity={0.8}
          >
            <Text variant="caption" weight="600" style={styles.refreshBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Lista ─────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* Cabecera unificada */}
      <PageHeader title="Tus Reservas" rightElement={countPill} withSeparator />

      <FlatList
        data={reservations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          reservations.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState onRefresh={() => fetchReservations()} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchReservations(true)}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />

      {/* FAB — nueva reserva */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => router.push("/booking")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Nueva reserva"
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,
  },
  centered: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
    gap:            12,
  },

  // ── Pill de conteo (rightElement del PageHeader) ──────────
  countPill: {
    backgroundColor:   Colors.primarySubtle,
    borderRadius:      999,
    paddingHorizontal: 9,
    paddingVertical:   3,
  },
  countText: {
    color:      Colors.primary,
    fontWeight: "700",
  },

  // ── Lista ─────────────────────────────────────────────────
  list: {
    padding: 16,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },

  // ── Ticket ────────────────────────────────────────────────
  ticketCard: {
    overflow: "hidden",
  },
  ticketInner: {
    flexDirection: "row",
  },
  ticketAccent: {
    width: 5,
  },
  ticketBody: {
    flex:    1,
    padding: 14,
    gap:     4,
  },
  ticketTop: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    gap:            8,
    marginBottom:   2,
  },
  courtName: {
    flex:  1,
    color: Colors.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
  },
  sportLabel: {
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginTop:     2,
  },
  infoIconGap: {
    marginLeft: 8,
  },
  infoText: {
    color: Colors.textMuted,
  },
  price: {
    color:     Colors.primary,
    marginTop: 4,
  },

  // ── Estado vacío ─────────────────────────────────────────
  emptyContainer: {
    flex:              1,
    justifyContent:    "center",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 32,
    paddingVertical:   48,
  },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: Colors.primarySubtle,
    justifyContent:  "center",
    alignItems:      "center",
    marginBottom:    4,
  },
  emptyTitle: {
    color:     Colors.text,
    textAlign: "center",
  },
  emptyBody: {
    textAlign:  "center",
    lineHeight: 20,
  },

  // ── Botón secundario ─────────────────────────────────────
  refreshBtn: {
    marginTop:         8,
    paddingHorizontal: 24,
    paddingVertical:   10,
    borderRadius:      10,
    backgroundColor:   Colors.primarySubtle,
    borderWidth:       1,
    borderColor:       Colors.primaryBorder,
  },
  refreshBtnText: {
    color: Colors.primary,
  },

  // ── Error ─────────────────────────────────────────────────
  errorTitle: {
    color: Colors.text,
  },
  errorBody: {
    textAlign:         "center",
    paddingHorizontal: 24,
  },

  // ── FAB ───────────────────────────────────────────────────
  fab: {
    position:        "absolute",
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.primary,
    alignItems:      "center",
    justifyContent:  "center",
    ...Platform.select({
      ios: {
        shadowColor:   Colors.primary,
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius:  8,
      },
      android: { elevation: 6 },
    }),
  },
});
