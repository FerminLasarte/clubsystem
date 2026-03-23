/**
 * Reservar — Selector de Deporte (dinámico)
 * ===========================================
 * Consulta las canchas reales del usuario en sus clubs APPROVED,
 * extrae los deportes únicos disponibles y renderiza solo esos.
 * No muestra deportes hardcodeados que no existan en el club.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
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
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/utils/api";

// ── Config de deportes ─────────────────────────────────────────

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface SportConfig {
  label:       string;
  icon:        FeatherIconName;
  description: string;
}

const SPORT_CONFIG: Record<string, SportConfig> = {
  padel:      { label: "Pádel",       icon: "target",          description: "Canchas de pádel cubiertas y descubiertas" },
  tennis:     { label: "Tenis",       icon: "circle",          description: "Canchas de tenis en distintas superficies" },
  football:   { label: "Fútbol",      icon: "flag",            description: "Fútbol 5, 7 y 11" },
  basketball: { label: "Básquet",     icon: "box",             description: "Canchas de básquetbol" },
  hockey:     { label: "Hockey",      icon: "shuffle",         description: "Canchas de hockey" },
  volleyball: { label: "Vóley",       icon: "grid",            description: "Canchas de vóley" },
  other:      { label: "Otro",        icon: "more-horizontal", description: "Otras canchas disponibles" },
};

// ── Pantalla ───────────────────────────────────────────────────

export default function BookingSportSelectorScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { user } = useAuth();

  const [sports,     setSports]    = useState<string[]>([]);
  const [isLoading,  setIsLoading] = useState(true);
  const [error,      setError]     = useState<string | null>(null);

  // Construye la lista de clubIds únicos del usuario (membresías + legacy)
  const getClubIds = useCallback((): string[] => {
    if (!user) return [];
    return [
      ...(user.memberships ?? [])
        .filter((m) => m.status === "APPROVED")
        .map((m) => m.clubId),
      ...(user.clubId ? [user.clubId] : []),
    ].filter((id, i, arr) => arr.indexOf(id) === i);
  }, [user]);

  const loadSports = useCallback(async () => {
    const clubIds = getClubIds();
    if (clubIds.length === 0) {
      setSports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        clubIds.map((id) =>
          apiClient.get<{ sport: string }[]>(`/mobile/clubs/${id}/courts`)
        )
      );
      // Extrae deportes únicos preservando el orden de aparición
      const unique = [...new Set(results.flat().map((c) => c.sport))];
      setSports(unique);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar deportes");
    } finally {
      setIsLoading(false);
    }
  }, [getClubIds]);

  useEffect(() => { loadSports(); }, [loadSports]);

  const handleSelectSport = (sportKey: string) => {
    router.push({
      pathname: "/booking/[courtId]",
      params:   { courtId: sportKey },
    });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      <PageHeader
        title="Reservar cancha"
        rightElement={
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.closeBtn}
          >
            <Feather name="x" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={Colors.danger} />
          <Text variant="body" muted style={styles.centeredText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSports} activeOpacity={0.8}>
            <Text variant="caption" weight="600" style={{ color: Colors.primary }}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : sports.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="grid" size={36} color={Colors.surfaceRaised} />
          <Text variant="body" muted style={styles.centeredText}>
            No hay canchas disponibles en tus clubs
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="body" muted style={styles.subtitle}>
            ¿Qué deporte querés reservar?
          </Text>

          <View style={styles.list}>
            {sports.map((sportKey) => {
              const cfg: SportConfig = SPORT_CONFIG[sportKey] ?? {
                label:       sportKey.charAt(0).toUpperCase() + sportKey.slice(1),
                icon:        "grid" as FeatherIconName,
                description: "Canchas disponibles",
              };
              return (
                <Card key={sportKey} onPress={() => handleSelectSport(sportKey)}>
                  <View style={styles.row}>
                    <View style={styles.iconWrap}>
                      <Feather name={cfg.icon} size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.info}>
                      <Text variant="subheading" weight="700" style={styles.sportLabel}>
                        {cfg.label}
                      </Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {cfg.description}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={Colors.placeholder} />
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: Colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },
  centered: {
    flex:              1,
    justifyContent:    "center",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 32,
  },
  centeredText: {
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   Colors.primarySubtle,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
  },
  subtitle: {
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    12,
    backgroundColor: Colors.primarySubtle,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.primary,
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius:  4,
      },
    }),
  },
  info: {
    flex: 1,
    gap:  3,
  },
  sportLabel: {
    color: Colors.text,
  },
});
