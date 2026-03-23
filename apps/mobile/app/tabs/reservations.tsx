/**
 * Mis Reservas — Portal del Jugador
 * ===================================
 * Pantalla principal de reservas del socio.
 * Muestra los próximos turnos (starts_at > now, status ≠ cancelled).
 *
 * Flujo:
 *   1. Al montar, llama a GET /api/v1/mobile/reservations/me (con Bearer JWT).
 *   2. Muestra un spinner mientras carga.
 *   3. Si hay reservas, las lista en cards (cancha, deporte, fecha, hora, estado).
 *   4. Si no hay reservas, muestra un estado vacío amigable.
 *   5. Pull-to-refresh para actualizar.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { apiClient } from "@/utils/api";

// ── Tipos ─────────────────────────────────────────────────────

interface ReservationMeOut {
  id: string;
  court_name: string;
  sport: string;
  starts_at: string;   // ISO 8601 UTC
  ends_at: string;
  status: "pending" | "confirmed" | "completed";
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
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Componentes ───────────────────────────────────────────────

function ReservationCard({ item }: { item: ReservationMeOut }) {
  const statusColor = STATUS_COLORS[item.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const sportLabel  = SPORT_LABELS[item.sport]   ?? item.sport;

  return (
    <View style={styles.card}>
      {/* Barra lateral de color de estado */}
      <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />

      <View style={styles.cardBody}>
        {/* Fila superior: cancha + estado */}
        <View style={styles.cardRow}>
          <Text style={styles.courtName} numberOfLines={1}>
            {item.court_name}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Deporte */}
        <Text style={styles.sportLabel}>{sportLabel}</Text>

        {/* Fecha y hora */}
        <View style={styles.scheduleRow}>
          <Feather name="calendar" size={13} color={Colors.textMuted} />
          <Text style={styles.scheduleText}>{formatDate(item.starts_at)}</Text>
          <Feather
            name="clock"
            size={13}
            color={Colors.textMuted}
            style={styles.scheduleIcon}
          />
          <Text style={styles.scheduleText}>
            {formatTime(item.starts_at)} – {formatTime(item.ends_at)}
          </Text>
        </View>

        {/* Precio */}
        {item.total_price > 0 && (
          <Text style={styles.price}>
            ${item.total_price.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
          </Text>
        )}
      </View>
    </View>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Feather name="calendar" size={36} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Sin turnos próximos</Text>
      <Text style={styles.emptyBody}>
        Cuando reserves una cancha, tus turnos aparecerán acá.
      </Text>
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
        <Text style={styles.refreshBtnText}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────

export default function ReservationsScreen() {
  const insets = useSafeAreaInsets();

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
    ({ item }) => <ReservationCard item={item} />,
    []
  );

  const keyExtractor = useCallback((item: ReservationMeOut) => item.id, []);

  // ── Render: loading inicial ───────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Render: error ─────────────────────────────────────────

  if (error) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <Feather name="alert-circle" size={36} color={Colors.danger} />
        <Text style={styles.errorTitle}>Algo salió mal</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchReservations()}
          activeOpacity={0.8}
        >
          <Text style={styles.refreshBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: lista ─────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis próximos turnos</Text>
        {reservations.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{reservations.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={reservations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          reservations.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
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
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  countPill: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Lista
  list: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 5,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  courtName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sportLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  scheduleIcon: {
    marginLeft: 8,
  },
  scheduleText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  price: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
    marginTop: 2,
  },

  // Estado vacío
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Botón secundario
  refreshBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },

  // Error
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  errorBody: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
