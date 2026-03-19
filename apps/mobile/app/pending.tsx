/**
 * Pantalla de Invitaciones Pendientes — ClubSync Mobile
 *
 * Se muestra cuando el usuario está autenticado (JWT limitado)
 * pero todavía no tiene un club activo asignado.
 *
 * Muestra:
 *  - Si hay invitaciones PENDING: lista de clubs con botón "Aceptar".
 *  - Si no hay invitaciones: mensaje de espera con opción de cerrar sesión.
 *
 * Al aceptar, acceptInvitation() reemplaza el JWT limitado por uno completo
 * y app/index.tsx redirige automáticamente a /tabs.
 */

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";

import { Colors, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/config/api";

// ── Tipos ─────────────────────────────────────────────────────

interface PendingInvitation {
  id: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  role: string;
  primary_color: string;
  logo_url: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:                "Propietario",
  RESERVATIONS_MANAGER: "Gestor de Reservas",
  STOCK_MANAGER:        "Gestor de Stock",
};

// ── Component ─────────────────────────────────────────────────

const C = Colors.light;

export default function PendingScreen() {
  const { token, user, acceptInvitation, logout } = useAuth();

  const [invitations,  setInvitations]  = useState<PendingInvitation[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [acceptingId,  setAcceptingId]  = useState<string | null>(null);

  // Si ya tiene club, index.tsx se encarga de redirigir a /tabs
  if (user?.hasClub) return <Redirect href="/tabs" />;

  // ── Fetch invitaciones ──────────────────────────────────────

  const fetchInvitations = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // ── Aceptar invitación ──────────────────────────────────────

  const handleAccept = async (staffId: string, clubName: string) => {
    Alert.alert(
      "Aceptar invitación",
      `¿Querés unirte al equipo de ${clubName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          onPress: async () => {
            setAcceptingId(staffId);
            try {
              await acceptInvitation(staffId);
              // index.tsx detecta hasClub=true y redirige a /tabs automáticamente
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "No se pudo aceptar la invitación."
              );
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Acento superior */}
      <View style={styles.topAccent} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconRing}>
            <Feather name="mail" size={28} color={C.tint} />
          </View>
          <Text style={styles.title}>Invitaciones pendientes</Text>
          <Text style={styles.subtitle}>
            Un administrador de club te invitó a unirte a su equipo.
            Aceptá para acceder al panel de gestión.
          </Text>
        </View>

        {/* Lista */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={C.tint}
            style={{ marginTop: Spacing.xl }}
          />
        ) : invitations.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="clock" size={36} color={C.placeholder} />
            <Text style={styles.emptyTitle}>Sin invitaciones por ahora</Text>
            <Text style={styles.emptyBody}>
              Pedile a un administrador de club que te invite.
              Una vez que lo haga, aparecerá aquí.
            </Text>
            <Pressable
              onPress={fetchInvitations}
              style={({ pressed }) => [
                styles.refreshBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="refresh-cw" size={14} color={C.tint} />
              <Text style={styles.refreshBtnText}>Actualizar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={invitations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                {/* Color del club como acento */}
                <View
                  style={[
                    styles.cardAccent,
                    { backgroundColor: item.primary_color || C.tint },
                  ]}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.clubName}>{item.club_name}</Text>
                  <Text style={styles.roleName}>
                    {ROLE_LABELS[item.role] ?? item.role}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleAccept(item.id, item.club_name)}
                  disabled={acceptingId === item.id}
                  style={({ pressed }) => [
                    styles.acceptBtn,
                    pressed && { opacity: 0.8 },
                    acceptingId === item.id && { opacity: 0.5 },
                  ]}
                >
                  {acceptingId === item.id ? (
                    <ActivityIndicator size="small" color={C.textOnBrand} />
                  ) : (
                    <Text style={styles.acceptBtnText}>Aceptar</Text>
                  )}
                </Pressable>
              </View>
            )}
          />
        )}

        {/* Cerrar sesión */}
        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="log-out" size={14} color={C.textMuted} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  topAccent: {
    height: 3,
    backgroundColor: C.tint,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: C.tintSubtle,
    backgroundColor: C.tintSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Estado vacío
  emptyBox: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
    marginTop: Spacing.sm,
  },
  emptyBody: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.tint,
  },
  refreshBtnText: {
    fontSize: 13,
    color: C.tint,
    fontWeight: "500",
  },

  // Card de invitación
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  clubName: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  roleName: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  acceptBtn: {
    marginRight: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: C.tint,
    borderRadius: Radius.md,
    minWidth: 72,
    alignItems: "center",
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textOnBrand,
  },

  // Cerrar sesión
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  logoutText: {
    fontSize: 13,
    color: C.textMuted,
  },
});
