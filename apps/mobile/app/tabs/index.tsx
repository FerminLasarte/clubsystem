// app/tabs/index.tsx
// Home — Portal del Jugador (dashboard unificado)
//
// Un único HomeScreen para todos los usuarios:
//   • Header con saludo, avatar y buscador
//   • Quick Actions cableadas a navegación real
//   • Sección "Tus Reservas" con datos reales (máx. 3)
//   • Torneos → tarjeta "Próximamente"
//   • Si tiene membresía APPROVED → NewsSection (datos reales de /mobile/news)
//   • Si no tiene membresía       → ExploreSection (directorio de clubs + modal de solicitud)
//
// Carga: useFocusEffect — spinner en la primera visita, silencioso en las siguientes.

import React, {
  useCallback,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/utils/api";

// ── Tipos ──────────────────────────────────────────────────────

type ReservationStatus = "pending" | "confirmed" | "completed";

interface ReservationMeOut {
  id:          string;
  court_name:  string;
  sport:       string;
  starts_at:   string;   // ISO 8601 UTC
  ends_at:     string;
  status:      ReservationStatus;
  total_price: number;
}

interface MobileNewsItem {
  id:         string;
  club_id:    string;
  club_name:  string;
  title:      string;
  body:       string;
  tag:        string | null;
  created_at: string;
}

interface ClubDirectoryItem {
  id:            string;
  name:          string;
  sport_types:   string[];
  logo_url:      string | null;
  primary_color: string;
  address:       string | null;
  city:          string | null;
}

// ── Helpers ────────────────────────────────────────────────────

const STATUS_COLOR: Record<ReservationStatus, string> = {
  pending:   Colors.statusPending,
  confirmed: Colors.statusConfirmed,
  completed: Colors.statusCompleted,
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRelativeDate(iso: string): string {
  const d       = new Date(iso);
  const now     = new Date();
  const diffMs  = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7)  return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ── Sub-componentes reutilizables ──────────────────────────────

function FakeSearchBar() {
  const router    = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => router.push("/search")}
      accessible
      accessibilityRole="search"
      accessibilityLabel="Buscar canchas, socios o torneos"
    >
      <Animated.View style={[styles.fakeSearch, { transform: [{ scale: scaleAnim }] }]}>
        <Feather name="search" size={15} color={Colors.placeholder} style={styles.searchIcon} />
        <Text variant="body" style={styles.fakeSearchText}>
          Buscar canchas, socios, torneos…
        </Text>
        <View style={styles.fakeSearchKbd}>
          <Text variant="label" style={styles.fakeSearchKbdText}>⌘K</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function SectionHeader({ title, onAction, actionLabel }: {
  title:       string;
  onAction?:   () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading">{title}</Text>
      {onAction && actionLabel && (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
          <Text variant="caption" style={styles.seeAll}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ReservationTicket({ item, onPress }: { item: ReservationMeOut; onPress: () => void }) {
  const statusColor = STATUS_COLOR[item.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABEL[item.status] ?? item.status;

  return (
    <Card padding={0} style={styles.ticketCard} onPress={onPress}>
      <View style={styles.ticketInner}>
        <View style={[styles.ticketAccent, { backgroundColor: statusColor }]} />
        <View style={styles.ticketBody}>
          <View style={styles.ticketHeaderRow}>
            <Text variant="subheading" weight="700" style={styles.courtName} numberOfLines={1}>
              {item.court_name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
              <Text variant="label" style={{ color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>
          <Text variant="caption" muted style={styles.sportLabel}>{item.sport}</Text>
          <View style={styles.scheduleRow}>
            <Feather name="calendar" size={12} color={Colors.textMuted} />
            <Text variant="caption" muted style={styles.scheduleText}>
              {formatDate(item.starts_at)}
            </Text>
            <Feather name="clock" size={12} color={Colors.textMuted} style={styles.scheduleIconGap} />
            <Text variant="caption" muted style={styles.scheduleText}>
              {formatTime(item.starts_at)} – {formatTime(item.ends_at)}
            </Text>
          </View>
          {item.total_price > 0 && (
            <Text variant="caption" weight="600" style={styles.ticketPrice}>
              ${item.total_price.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function NewsCard({ item }: { item: MobileNewsItem }) {
  return (
    <Card padding={14}>
      <View style={styles.newsHeader}>
        {item.tag ? (
          <View style={styles.newsTagPill}>
            <Text variant="label" style={styles.newsTagText}>{item.tag}</Text>
          </View>
        ) : (
          <View />
        )}
        <Text variant="caption" muted>{formatRelativeDate(item.created_at)}</Text>
      </View>
      <Text variant="subheading" style={styles.newsTitle}>{item.title}</Text>
      <Text variant="body" muted style={styles.newsBody} numberOfLines={3}>{item.body}</Text>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// HOME SCREEN UNIFICADO
// ══════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, fetchMemberships } = useAuth();

  const hasApprovedMembership =
    (user?.memberships ?? []).some((m) => m.status === "APPROVED") ||
    (user?.clubId != null);

  // ── Estado ─────────────────────────────────────────────────
  const [reservations, setReservations] = useState<ReservationMeOut[]>([]);
  const [news,         setNews]         = useState<MobileNewsItem[]>([]);
  const [clubs,        setClubs]        = useState<ClubDirectoryItem[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Estado del modal de solicitud de membresía ─────────────
  const [searchQuery,  setSearchQuery]  = useState("");
  const [selectedClub, setSelectedClub] = useState<ClubDirectoryItem | null>(null);
  const [joinDni,      setJoinDni]      = useState("");
  const [joinLoading,  setJoinLoading]  = useState(false);
  const [joinError,    setJoinError]    = useState<string | null>(null);
  const [joinSuccess,  setJoinSuccess]  = useState(false);

  const hasLoadedRef = useRef(false);

  const firstName = user?.firstName ?? "";
  const lastName  = user?.lastName  ?? "";
  const initials  = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  // ── Fetch ──────────────────────────────────────────────────

  const fetchAll = useCallback(async (
    opts: { refreshing?: boolean; silent?: boolean } = {},
  ) => {
    if (opts.refreshing) setIsRefreshing(true);
    else if (!opts.silent) setIsLoading(true);

    try {
      const [resResult, sectionResult] = await Promise.allSettled([
        apiClient.get<ReservationMeOut[]>("/mobile/reservations/me"),
        hasApprovedMembership
          ? apiClient.get<MobileNewsItem[]>("/mobile/news")
          : apiClient.get<ClubDirectoryItem[]>("/mobile/clubs"),
      ]);

      if (resResult.status === "fulfilled") {
        setReservations(resResult.value);
      }

      if (sectionResult.status === "fulfilled") {
        if (hasApprovedMembership) {
          setNews(sectionResult.value as MobileNewsItem[]);
        } else {
          setClubs(sectionResult.value as ClubDirectoryItem[]);
        }
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [hasApprovedMembership]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        fetchAll();
        hasLoadedRef.current = true;
      } else {
        fetchAll({ silent: true });
      }
    }, [fetchAll]),
  );

  // ── Quick actions ──────────────────────────────────────────

  const QUICK_ACTIONS = [
    { icon: "calendar" as const, label: "Reservar",   onPress: () => router.push("/booking") },
    { icon: "clock"    as const, label: "Mis turnos", onPress: () => router.push("/tabs/reservations") },
    { icon: "users"    as const, label: "Socios",     onPress: undefined },
    { icon: "award"    as const, label: "Torneos",    onPress: undefined },
  ];

  // ── Modal handlers ─────────────────────────────────────────

  const membershipStatus = (clubId: string) =>
    user?.memberships?.find((m) => m.clubId === clubId)?.status ?? null;

  const openModal = (club: ClubDirectoryItem) => {
    setSelectedClub(club);
    setJoinDni("");
    setJoinError(null);
    setJoinSuccess(false);
  };

  const closeModal = () => {
    setSelectedClub(null);
    setJoinSuccess(false);
  };

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

  const filteredClubs = searchQuery.trim()
    ? clubs.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.city ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : clubs;

  // ── Loading inicial ────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchAll({ refreshing: true })}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="caption" style={styles.greeting}>Hola,</Text>
            <Text variant="title" style={styles.memberName}>{firstName || "Socio"}.</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.8}
            onPress={() => router.push("/tabs/profile")}
          >
            <View style={styles.avatar}>
              <Text variant="label" weight="700" color={Colors.textOnBrand} style={styles.avatarText}>
                {initials}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Buscador ── */}
        <View style={styles.searchWrapper}>
          <FakeSearchBar />
        </View>

        {/* ── Quick Actions ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickActionsScroll}
          contentContainerStyle={styles.quickActions}
        >
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickBtn}
              activeOpacity={a.onPress ? 0.7 : 1}
              onPress={a.onPress}
              disabled={!a.onPress}
            >
              <Card padding={0} style={[styles.quickIconCard, !a.onPress && styles.quickIconDisabled]}>
                <Feather name={a.icon} size={20} color={a.onPress ? Colors.primary : Colors.textMuted} />
              </Card>
              <Text variant="label" style={[styles.quickLabel, !a.onPress && styles.quickLabelDisabled]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Reservas ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Tus Reservas"
            actionLabel="Ver todas →"
            onAction={() => router.push("/tabs/reservations")}
          />
          {reservations.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {reservations.slice(0, 3).map((r) => (
                <ReservationTicket
                  key={r.id}
                  item={r}
                  onPress={() =>
                    router.push({
                      pathname: "/reservation/[id]",
                      params: {
                        id:          r.id,
                        court_name:  r.court_name,
                        sport:       r.sport,
                        starts_at:   r.starts_at,
                        ends_at:     r.ends_at,
                        status:      r.status,
                        total_price: String(r.total_price),
                      },
                    })
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyReservations}>
              <Feather name="calendar" size={20} color={Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="body" muted>No tenés turnos próximos.</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/booking")}>
                  <Text variant="caption" style={styles.emptyAction}>Reservar ahora →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Torneos (Próximamente) ── */}
        <View style={styles.section}>
          <SectionHeader title="Torneos" />
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIcon}>
              <Feather name="award" size={22} color={Colors.primary} />
            </View>
            <View>
              <Text variant="subheading" weight="700" style={styles.comingSoonTitle}>
                Torneos
              </Text>
              <Text variant="caption" muted>Próximamente</Text>
            </View>
          </View>
        </View>

        {/* ── Sección condicional ── */}
        {hasApprovedMembership ? (
          /* Novedades del club (miembros) */
          <View style={styles.section}>
            <SectionHeader title="Novedades" />
            {news.length > 0 ? (
              <View style={styles.newsList}>
                {news.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </View>
            ) : (
              <Card padding={14} style={styles.emptyNewsCard}>
                <Text variant="body" muted style={{ textAlign: "center" }}>
                  Tu club no ha publicado novedades todavía.
                </Text>
              </Card>
            )}
          </View>
        ) : (
          /* Explorar clubs (sin membresía) */
          <View style={styles.section}>
            <SectionHeader title="Encontrá tu Club" />

            {/* Buscador de clubs */}
            <View style={styles.clubSearchWrap}>
              <Feather name="search" size={14} color={Colors.placeholder} style={styles.clubSearchIcon} />
              <TextInput
                style={styles.clubSearchInput}
                placeholder="Buscar clubs o ciudades…"
                placeholderTextColor={Colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                  <Feather name="x" size={14} color={Colors.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista de clubs */}
            {filteredClubs.length === 0 ? (
              <View style={styles.emptyClubs}>
                <Feather name="compass" size={36} color={Colors.surfaceRaised} />
                <Text variant="body" muted style={{ textAlign: "center" }}>
                  No se encontraron clubs
                </Text>
              </View>
            ) : (
              <View style={styles.clubList}>
                {filteredClubs.map((club) => {
                  const status = membershipStatus(club.id);
                  return (
                    <Card key={club.id} onPress={() => openModal(club)} style={styles.clubCard}>
                      <View style={styles.clubCardRow}>
                        <View style={[styles.clubAvatar, { backgroundColor: club.primary_color }]}>
                          <Text variant="subheading" weight="700" color="#FFFFFF">
                            {club.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.clubInfo}>
                          <Text variant="subheading" weight="700" style={styles.clubName}>
                            {club.name}
                          </Text>
                          {club.city && (
                            <View style={styles.clubMeta}>
                              <Feather name="map-pin" size={11} color={Colors.textMuted} />
                              <Text variant="caption" muted>{club.city}</Text>
                            </View>
                          )}
                          {club.sport_types?.length > 0 && (
                            <Text variant="label" muted numberOfLines={1}>
                              {club.sport_types.join(" · ")}
                            </Text>
                          )}
                        </View>
                        {status === "APPROVED" && (
                          <View style={[styles.statusBadge, styles.statusApproved]}>
                            <Text variant="label" style={styles.statusApprovedText}>Socio</Text>
                          </View>
                        )}
                        {status === "PENDING" && (
                          <View style={[styles.statusBadge, styles.statusPending]}>
                            <Text variant="label" style={styles.statusPendingText}>Pendiente</Text>
                          </View>
                        )}
                        {!status && (
                          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Modal: solicitar membresía ── */}
      <Modal
        visible={selectedClub !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={[styles.modalClubAvatar, { backgroundColor: selectedClub?.primary_color ?? Colors.primary }]}>
              <Text variant="title" weight="700" color="#FFFFFF">
                {selectedClub?.name.charAt(0).toUpperCase() ?? ""}
              </Text>
            </View>
            <Text variant="heading" style={styles.modalClubName}>
              {selectedClub?.name}
            </Text>
            {selectedClub?.city && (
              <View style={styles.modalMeta}>
                <Feather name="map-pin" size={12} color={Colors.textMuted} />
                <Text variant="caption" muted>{selectedClub.city}</Text>
              </View>
            )}
            {selectedClub?.sport_types && selectedClub.sport_types.length > 0 && (
              <Text variant="caption" muted style={styles.modalSports}>
                {selectedClub.sport_types.join(" · ")}
              </Text>
            )}

            <View style={styles.modalDivider} />

            {(() => {
              const status = selectedClub ? membershipStatus(selectedClub.id) : null;
              if (status === "APPROVED") {
                return (
                  <View style={styles.alreadyMemberBox}>
                    <Feather name="check-circle" size={20} color={Colors.success} />
                    <Text variant="body" style={styles.alreadyMemberText}>
                      Ya sos socio de este club
                    </Text>
                  </View>
                );
              }
              if (status === "PENDING") {
                return (
                  <View style={styles.pendingBox}>
                    <Feather name="clock" size={20} color={Colors.statusPending} />
                    <Text variant="body" style={styles.pendingText}>
                      Tu solicitud está siendo revisada
                    </Text>
                  </View>
                );
              }
              if (joinSuccess) {
                return (
                  <View style={styles.successBox}>
                    <Feather name="send" size={20} color={Colors.success} />
                    <Text variant="body" style={styles.successText}>
                      ¡Solicitud enviada! El club te notificará cuando sea aprobada.
                    </Text>
                  </View>
                );
              }
              return (
                <>
                  <Text variant="body" muted style={styles.modalBody}>
                    Solicitá unirte a {selectedClub?.name} como socio. El administrador
                    del club revisará tu solicitud.
                  </Text>
                  <Text variant="label" style={styles.dniLabel}>DNI (opcional)</Text>
                  <View style={styles.dniInput}>
                    <TextInput
                      style={styles.dniInputText}
                      placeholder="Ej: 30123456"
                      placeholderTextColor={Colors.placeholder}
                      value={joinDni}
                      onChangeText={setJoinDni}
                      keyboardType="numeric"
                      maxLength={12}
                    />
                  </View>
                  {joinError && (
                    <Text variant="caption" style={styles.joinError}>{joinError}</Text>
                  )}
                  <TouchableOpacity
                    style={[styles.joinBtn, joinLoading && styles.joinBtnDisabled]}
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
              <Text variant="body" style={styles.closeBtnText}>Cerrar</Text>
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
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    paddingHorizontal: 20,
    paddingTop:        22,
    paddingBottom:     6,
  },
  headerText: {
    gap: 1,
  },
  greeting: {
    color: Colors.textMuted,
  },
  memberName: {
    color: Colors.primary,
  },
  avatarWrap: {
    marginTop: 6,
  },
  avatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.primary,
    justifyContent:  "center",
    alignItems:      "center",
  },
  avatarText: {
    fontSize:   14,
    fontWeight: "700",
  },

  // ── Buscador ─────────────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop:        6,
    paddingBottom:     8,
  },
  fakeSearch: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   Colors.cardBackground,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   Platform.OS === "ios" ? 13 : 11,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.shadow,
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius:  6,
      },
      android: { elevation: 1 },
    }),
  },
  searchIcon: { marginRight: 10 },
  fakeSearchText: {
    flex:  1,
    color: Colors.placeholder,
  },
  fakeSearchKbd: {
    backgroundColor:   Colors.surfaceRaised,
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  fakeSearchKbdText: {
    color: Colors.textMuted,
  },

  // ── Quick Actions ─────────────────────────────────────────────
  quickActionsScroll: {},
  quickActions: {
    flexDirection:     "row",
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     28,
    gap:               16,
  },
  quickBtn: {
    alignItems: "center",
    gap:        8,
  },
  quickIconCard: {
    width:          60,
    height:         60,
    borderRadius:   18,
    justifyContent: "center",
    alignItems:     "center",
  },
  quickIconDisabled: {
    opacity: 0.5,
  },
  quickLabel: {
    color: Colors.textMuted,
  },
  quickLabelDisabled: {
    opacity: 0.5,
  },

  // ── Sections ──────────────────────────────────────────────────
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingHorizontal: 20,
    marginBottom:      12,
  },
  seeAll: {
    color:      Colors.primary,
    fontWeight: "500",
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap:               12,
  },

  // ── Ticket ────────────────────────────────────────────────────
  ticketCard: {
    width:    280,
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
  ticketHeaderRow: {
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
    marginBottom: 1,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginTop:     2,
  },
  scheduleIconGap: {
    marginLeft: 6,
  },
  scheduleText: {
    color: Colors.textMuted,
  },
  ticketPrice: {
    color:     Colors.primary,
    marginTop: 4,
  },

  // ── Empty reservations ────────────────────────────────────────
  emptyReservations: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    marginHorizontal:  20,
    backgroundColor:   Colors.cardBackground,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       Colors.border,
    padding:           16,
  },
  emptyAction: {
    color:     Colors.primary,
    marginTop: 4,
  },

  // ── Torneos próximamente ──────────────────────────────────────
  comingSoonCard: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               14,
    marginHorizontal:  20,
    backgroundColor:   Colors.cardBackground,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       Colors.border,
    padding:           16,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.shadow,
        shadowOffset:  { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius:  4,
      },
      android: { elevation: 1 },
    }),
  },
  comingSoonIcon: {
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: Colors.primarySubtle,
    justifyContent:  "center",
    alignItems:      "center",
  },
  comingSoonTitle: {
    color: Colors.text,
  },

  // ── News ──────────────────────────────────────────────────────
  newsList: {
    paddingHorizontal: 20,
    gap:               10,
  },
  emptyNewsCard: {
    marginHorizontal: 20,
  },
  newsHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   6,
  },
  newsTagPill: {
    backgroundColor:   Colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      6,
  },
  newsTagText: {
    color: Colors.textMuted,
  },
  newsTitle: {
    color:        Colors.text,
    marginBottom: 2,
  },
  newsBody: {
    lineHeight: 19,
  },

  // ── Explore clubs ─────────────────────────────────────────────
  clubSearchWrap: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   Colors.cardBackground,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.border,
    marginHorizontal:  20,
    marginBottom:      12,
    paddingHorizontal: 14,
    paddingVertical:   Platform.OS === "ios" ? 11 : 9,
  },
  clubSearchIcon: { marginRight: 8 },
  clubSearchInput: {
    flex:     1,
    color:    Colors.text,
    fontSize: 14,
  },
  clubList: {
    paddingHorizontal: 20,
    gap:               10,
  },
  clubCard: {},
  clubCardRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  clubAvatar: {
    width:          46,
    height:         46,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
    flexShrink:     0,
  },
  clubInfo: {
    flex: 1,
    gap:  3,
  },
  clubName: {
    color: Colors.text,
  },
  clubMeta: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
    flexShrink:        0,
  },
  statusApproved: {
    backgroundColor: Colors.successSurface,
  },
  statusApprovedText: {
    color: Colors.success,
  },
  statusPending: {
    backgroundColor: Colors.warningSurface,
  },
  statusPendingText: {
    color: Colors.statusPending,
  },
  emptyClubs: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },

  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent:  "flex-end",
  },
  modalSheet: {
    backgroundColor:      Colors.cardBackground,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        40,
    paddingTop:           12,
    alignItems:           "center",
  },
  modalHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.surfaceRaised,
    marginBottom:    20,
  },
  modalClubAvatar: {
    width:          72,
    height:         72,
    borderRadius:   22,
    justifyContent: "center",
    alignItems:     "center",
    marginBottom:   12,
  },
  modalClubName: {
    color:        Colors.primary,
    textAlign:    "center",
    marginBottom: 4,
  },
  modalMeta: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginBottom:  4,
  },
  modalSports: {
    textAlign:    "center",
    marginBottom: 4,
  },
  modalDivider: {
    width:           "100%",
    height:          1,
    backgroundColor: Colors.border,
    marginVertical:  16,
  },
  modalBody: {
    textAlign:    "center",
    color:        Colors.textMuted,
    marginBottom: 16,
    lineHeight:   20,
  },
  dniLabel: {
    alignSelf:    "flex-start",
    color:        Colors.textMuted,
    marginBottom: 6,
  },
  dniInput: {
    width:             "100%",
    backgroundColor:   Colors.surface,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   12,
    marginBottom:      16,
  },
  dniInputText: {
    fontSize: 15,
    color:    Colors.text,
  },
  joinError: {
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
  joinBtnDisabled: {
    opacity: 0.6,
  },
  alreadyMemberBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: Colors.successSurface,
    borderRadius:    12,
    padding:         14,
    width:           "100%",
    marginBottom:    16,
  },
  alreadyMemberText: {
    color: Colors.success,
    flex:  1,
  },
  pendingBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: Colors.warningSurface,
    borderRadius:    12,
    padding:         14,
    width:           "100%",
    marginBottom:    16,
  },
  pendingText: {
    color: Colors.statusPending,
    flex:  1,
  },
  successBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: Colors.successSurface,
    borderRadius:    12,
    padding:         14,
    width:           "100%",
    marginBottom:    16,
  },
  successText: {
    color: Colors.success,
    flex:  1,
  },
  closeBtn: {
    paddingVertical: 12,
  },
  closeBtnText: {
    color: Colors.textMuted,
  },
});
