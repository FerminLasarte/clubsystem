// app/tabs/explore.tsx
// Explorar — Directorio de clubs accesible para cualquier usuario.
// Permite a socios activos descubrir otros clubs y solicitar membresía como visitante.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui/Text";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth, UserMembership } from "@/context/AuthContext";
import { apiClient } from "@/utils/api";

// ── Tipos ──────────────────────────────────────────────────────

interface ClubDirectoryItem {
  id:            string;
  name:          string;
  sport_types:   string[];
  logo_url:      string | null;
  primary_color: string;
  address:       string | null;
  city:          string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function membershipBadge(status: UserMembership["status"] | null) {
  if (status === "APPROVED") return { label: "Socio",       bg: Colors.successSurface, color: Colors.success };
  if (status === "PENDING")  return { label: "Pendiente",   bg: Colors.warningSurface, color: Colors.statusPending };
  if (status === "REJECTED") return { label: "Rechazado",   bg: Colors.dangerSurface,  color: Colors.danger };
  return null;
}

// ── Pantalla ───────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets                             = useSafeAreaInsets();
  const { user, fetchMemberships }         = useAuth();
  const [clubs, setClubs]                  = useState<ClubDirectoryItem[]>([]);
  const [isLoading, setIsLoading]          = useState(true);
  const [isRefreshing, setIsRefreshing]    = useState(false);
  const [searchQuery, setSearchQuery]      = useState("");
  const [selectedClub, setSelectedClub]   = useState<ClubDirectoryItem | null>(null);
  const [joinDni, setJoinDni]             = useState("");
  const [joinLoading, setJoinLoading]     = useState(false);
  const [joinError, setJoinError]         = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess]     = useState(false);

  const loadClubs = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await apiClient.get<ClubDirectoryItem[]>("/mobile/clubs");
      setClubs(data);
    } catch {
      /* silently fail */
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const filteredClubs = searchQuery.trim()
    ? clubs.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.city ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clubs;

  const getMembershipStatus = (clubId: string): UserMembership["status"] | null =>
    user?.memberships?.find((m) => m.clubId === clubId)?.status ?? null;

  const openModal = (club: ClubDirectoryItem) => {
    setSelectedClub(club);
    setJoinDni("");
    setJoinError(null);
    setJoinSuccess(false);
  };

  const closeModal = () => setSelectedClub(null);

  const handleJoinRequest = async () => {
    if (!selectedClub) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      await apiClient.post(`/clubs/${selectedClub.id}/request-membership`, {
        dni: joinDni.trim() || null,
      });
      await fetchMemberships();
      setJoinSuccess(true);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Error al enviar la solicitud");
    } finally {
      setJoinLoading(false);
    }
  };

  // ── Render de ítem ────────────────────────────────────────────

  const renderItem = ({ item }: { item: ClubDirectoryItem }) => {
    const status = getMembershipStatus(item.id);
    const badge  = membershipBadge(status);

    return (
      <Card onPress={() => openModal(item)}>
        <View style={styles.itemRow}>
          {/* Avatar */}
          <View style={[styles.itemAvatar, { backgroundColor: item.primary_color }]}>
            <Text variant="subheading" weight="700" color="#FFFFFF">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Info */}
          <View style={styles.itemInfo}>
            <Text variant="subheading" weight="700" style={styles.itemName}>
              {item.name}
            </Text>
            {item.city && (
              <View style={styles.itemMeta}>
                <Feather name="map-pin" size={11} color={Colors.textMuted} />
                <Text variant="caption" muted style={styles.itemMetaText}>{item.city}</Text>
              </View>
            )}
            {item.sport_types?.length > 0 && (
              <Text variant="label" muted numberOfLines={1}>
                {item.sport_types.join(" · ")}
              </Text>
            )}
          </View>

          {/* Badge de membresía */}
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text variant="label" style={{ color: badge.color }}>{badge.label}</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={18} color={Colors.textMuted} />
          )}
        </View>
      </Card>
    );
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      <PageHeader title="Explorar" />

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={Colors.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar clubs o ciudades…"
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <Feather name="x" size={15} color={Colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadClubs(true)}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="compass" size={40} color={Colors.surfaceRaised} />
              <Text variant="body" muted style={styles.emptyText}>
                No se encontraron clubs
              </Text>
            </View>
          }
        />
      )}

      {/* Modal: solicitar membresía */}
      <Modal
        visible={selectedClub !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Avatar del club */}
            <View style={[styles.modalAvatar, { backgroundColor: selectedClub?.primary_color ?? Colors.primary }]}>
              <Text variant="title" weight="700" color="#FFFFFF">
                {selectedClub?.name.charAt(0).toUpperCase() ?? ""}
              </Text>
            </View>

            <Text variant="heading" style={styles.modalName}>{selectedClub?.name}</Text>

            {selectedClub?.city && (
              <View style={styles.modalMeta}>
                <Feather name="map-pin" size={12} color={Colors.textMuted} />
                <Text variant="caption" muted style={styles.modalMetaText}>{selectedClub.city}</Text>
              </View>
            )}
            {selectedClub?.sport_types && selectedClub.sport_types.length > 0 && (
              <Text variant="caption" muted style={styles.modalSports}>
                {selectedClub.sport_types.join(" · ")}
              </Text>
            )}

            <View style={styles.divider} />

            {/* Contenido según estado */}
            {(() => {
              const status = selectedClub ? getMembershipStatus(selectedClub.id) : null;
              if (status === "APPROVED") {
                return (
                  <View style={styles.stateBox}>
                    <Feather name="check-circle" size={20} color={Colors.success} />
                    <Text variant="body" style={styles.stateTextSuccess}>
                      Ya sos socio de este club
                    </Text>
                  </View>
                );
              }
              if (status === "PENDING") {
                return (
                  <View style={[styles.stateBox, styles.stateBoxWarning]}>
                    <Feather name="clock" size={20} color={Colors.statusPending} />
                    <Text variant="body" style={styles.stateTextWarning}>
                      Tu solicitud está siendo revisada
                    </Text>
                  </View>
                );
              }
              if (joinSuccess) {
                return (
                  <View style={styles.stateBox}>
                    <Feather name="send" size={20} color={Colors.success} />
                    <Text variant="body" style={styles.stateTextSuccess}>
                      ¡Solicitud enviada! El club te notificará cuando sea aprobada.
                    </Text>
                  </View>
                );
              }
              return (
                <>
                  <Text variant="body" muted style={styles.modalBody}>
                    Solicitá unirte como socio. El administrador del club revisará tu solicitud.
                  </Text>

                  <Text variant="label" style={styles.dniLabel}>DNI (opcional)</Text>
                  <View style={styles.dniWrap}>
                    <TextInput
                      style={styles.dniText}
                      placeholder="Ej: 30123456"
                      placeholderTextColor={Colors.placeholder}
                      value={joinDni}
                      onChangeText={setJoinDni}
                      keyboardType="numeric"
                      maxLength={12}
                    />
                  </View>

                  {joinError && (
                    <Text variant="caption" style={styles.errorText}>{joinError}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.joinBtn, joinLoading && { opacity: 0.6 }]}
                    onPress={handleJoinRequest}
                    activeOpacity={0.85}
                    disabled={joinLoading}
                  >
                    {joinLoading
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Text variant="body" weight="700" color="#FFFFFF">Solicitar membresía</Text>
                    }
                  </TouchableOpacity>
                </>
              );
            })()}

            <TouchableOpacity style={styles.closeBtn} onPress={closeModal} activeOpacity={0.7}>
              <Text variant="body" color={Colors.textMuted}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,
  },
  centered: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom:     8,
  },
  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   Colors.cardBackground,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   Platform.OS === "ios" ? 13 : 11,
    ...Platform.select({
      ios:     { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  searchIcon:  { marginRight: 10 },
  searchInput: {
    flex:     1,
    fontSize: 14,
    color:    Colors.text,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop:        4,
    paddingBottom:     48,
  },
  separator: {
    height: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  itemAvatar: {
    width:          46,
    height:         46,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
    flexShrink:     0,
  },
  itemInfo: {
    flex: 1,
    gap:  3,
  },
  itemName: {
    color: Colors.text,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  itemMetaText: {
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
    flexShrink:        0,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap:        12,
  },
  emptyText: {
    textAlign: "center",
  },

  // ── Modal ────────────────────────────────────────────────────
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent:  "flex-end",
  },
  sheet: {
    backgroundColor:      Colors.cardBackground,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        40,
    paddingTop:           12,
    alignItems:           "center",
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.surfaceRaised,
    marginBottom:    20,
  },
  modalAvatar: {
    width:          72,
    height:         72,
    borderRadius:   22,
    justifyContent: "center",
    alignItems:     "center",
    marginBottom:   12,
  },
  modalName: {
    color:        Colors.primary,
    textAlign:    "center",
    marginBottom: 4,
  },
  modalMeta: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    marginBottom:   4,
  },
  modalMetaText: { marginTop: 1 },
  modalSports: {
    textAlign:    "center",
    marginBottom: 4,
  },
  divider: {
    width:           "100%",
    height:          1,
    backgroundColor: Colors.border,
    marginVertical:  16,
  },
  stateBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: Colors.successSurface,
    borderRadius:    12,
    padding:         14,
    width:           "100%",
    marginBottom:    16,
  },
  stateBoxWarning: {
    backgroundColor: Colors.warningSurface,
  },
  stateTextSuccess: { color: Colors.success,       flex: 1 },
  stateTextWarning: { color: Colors.statusPending, flex: 1 },
  modalBody: {
    textAlign:    "center",
    marginBottom: 16,
    lineHeight:   20,
  },
  dniLabel: {
    alignSelf:    "flex-start",
    color:        Colors.textMuted,
    marginBottom: 6,
  },
  dniWrap: {
    width:             "100%",
    backgroundColor:   Colors.surface,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   12,
    marginBottom:      16,
  },
  dniText: {
    fontSize: 15,
    color:    Colors.text,
  },
  errorText: {
    color:        Colors.danger,
    textAlign:    "center",
    marginBottom: 8,
  },
  joinBtn: {
    width:           "100%",
    backgroundColor: Colors.primary,
    borderRadius:    14,
    paddingVertical: 15,
    alignItems:      "center",
    marginBottom:    12,
  },
  closeBtn: {
    paddingVertical: 12,
  },
});
