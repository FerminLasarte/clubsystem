// app/tabs/index.tsx
// Home — Portal del Jugador
// Renderizado condicional:
//   • Sin membresías APPROVED → <GuestHome>   (directorio de clubs + solicitar)
//   • Con membresía  APPROVED → <MemberDashboard> (dashboard personal)

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/utils/api";

// ── Tipos ──────────────────────────────────────────────────────

type ReservationStatus = "pending" | "confirmed" | "completed";

interface UpcomingReservation {
  id:        string;
  courtName: string;
  sport:     string;
  date:      string;
  timeRange: string;
  price:     number;
  status:    ReservationStatus;
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

type TournamentItem = (typeof TOURNAMENTS)[0];
type NewsItem       = (typeof NEWS)[0];

// ── Mock data (MemberDashboard) ────────────────────────────────

const UPCOMING: UpcomingReservation[] = [
  {
    id:        "r1",
    courtName: "Cancha 3",
    sport:     "Pádel",
    date:      "Lun 23 jun",
    timeRange: "18:00 – 19:30",
    price:     2400,
    status:    "confirmed",
  },
  {
    id:        "r2",
    courtName: "Cancha 1",
    sport:     "Tenis",
    date:      "Mié 25 jun",
    timeRange: "10:00 – 11:30",
    price:     3200,
    status:    "pending",
  },
];

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

const TOURNAMENTS = [
  {
    id:          "1",
    name:        "Torneo Dobles Pádel",
    date:        "22–24 jun",
    sport:       "Pádel",
    spots:       4,
    total_spots: 16,
    image:       "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400",
    color:       "#EBF8FF",
    accentColor: "#2B6CB0",
  },
  {
    id:          "2",
    name:        "Open de Tenis Sub-18",
    date:        "30 jun",
    sport:       "Tenis",
    spots:       8,
    total_spots: 32,
    image:       "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400",
    color:       "#F0FFF4",
    accentColor: "#276749",
  },
];

const NEWS = [
  {
    id:    "1",
    title: "Nuevos horarios de canchas cubiertas",
    body:  "A partir del 1 de julio, las canchas 5 y 6 habilitarán franjas nocturnas hasta las 23 h.",
    date:  "Hace 2 días",
    tag:   "Aviso",
  },
  {
    id:    "2",
    title: "Clase de iniciación al pádel — Julio",
    body:  "Inscribite antes del 20/6. Cupos limitados a 8 personas. Incluye raqueta prestada.",
    date:  "Hace 4 días",
    tag:   "Clases",
  },
  {
    id:    "3",
    title: "Mantenimiento preventivo — domingo 16 jun",
    body:  "Las canchas 1 a 3 estarán fuera de servicio de 08:00 a 12:00 h.",
    date:  "Hace 1 semana",
    tag:   "Mantenimiento",
  },
];

const QUICK_ACTIONS = [
  { icon: "calendar",  label: "Reservar"   },
  { icon: "clock",     label: "Mis turnos" },
  { icon: "users",     label: "Socios"     },
  { icon: "award",     label: "Torneos"    },
] as const;

// ══════════════════════════════════════════════════════════════
// GUEST HOME — Directorio de clubs para usuarios sin membresía
// ══════════════════════════════════════════════════════════════

function GuestHome() {
  const insets                                              = useSafeAreaInsets();
  const { user, fetchMemberships }                          = useAuth();
  const [clubs, setClubs]                                   = useState<ClubDirectoryItem[]>([]);
  const [isLoading, setIsLoading]                           = useState(true);
  const [isRefreshing, setIsRefreshing]                     = useState(false);
  const [searchQuery, setSearchQuery]                       = useState("");
  const [selectedClub, setSelectedClub]                     = useState<ClubDirectoryItem | null>(null);
  const [joinDni, setJoinDni]                               = useState("");
  const [joinLoading, setJoinLoading]                       = useState(false);
  const [joinError, setJoinError]                           = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess]                       = useState(false);

  const loadClubs = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await apiClient.get<ClubDirectoryItem[]>("/mobile/clubs");
      setClubs(data);
    } catch {
      // silently fail — mostramos lista vacía
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

  const firstName = user?.firstName ?? "";

  // ── Render de cada club en la lista ──────────────────────────

  const renderClub = ({ item }: { item: ClubDirectoryItem }) => {
    const status = membershipStatus(item.id);

    return (
      <Card onPress={() => openModal(item)} style={styles.clubCard}>
        <View style={styles.clubCardRow}>
          {/* Avatar del club (letra inicial o color brand) */}
          <View style={[styles.clubAvatar, { backgroundColor: item.primary_color }]}>
            <Text variant="subheading" weight="700" color="#FFFFFF">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.clubInfo}>
            <Text variant="subheading" weight="700" style={styles.clubName}>
              {item.name}
            </Text>
            {item.city && (
              <View style={styles.clubMeta}>
                <Feather name="map-pin" size={11} color={Colors.textMuted} />
                <Text variant="caption" muted style={styles.clubMetaText}>{item.city}</Text>
              </View>
            )}
            {item.sport_types?.length > 0 && (
              <Text variant="label" muted numberOfLines={1}>
                {item.sport_types.join(" · ")}
              </Text>
            )}
          </View>

          {/* Badge de estado */}
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
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* ── Header ── */}
      <View style={styles.guestHeader}>
        <View>
          <Text variant="caption" muted>Hola, {firstName || "bienvenido"}</Text>
          <Text variant="title" style={styles.guestTitle}>Encontrá tu Club</Text>
        </View>
      </View>

      {/* ── Buscador ── */}
      <View style={styles.guestSearchWrap}>
        <View style={styles.guestSearch}>
          <Feather name="search" size={15} color={Colors.placeholder} style={styles.guestSearchIcon} />
          <TextInput
            style={styles.guestSearchInput}
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

      {/* ── Lista de clubs ── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderClub}
          contentContainerStyle={styles.clubList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.clubSeparator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadClubs(true)}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="compass" size={40} color={Colors.surfaceRaised} />
              <Text variant="body" muted style={styles.emptyText}>
                No se encontraron clubs
              </Text>
            </View>
          }
        />
      )}

      {/* ── Modal: solicitar membresía ── */}
      <Modal
        visible={selectedClub !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Pill de arrastre */}
            <View style={styles.modalHandle} />

            {/* Cabecera del modal */}
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
                <Text variant="caption" muted style={styles.modalMetaText}>
                  {selectedClub.city}
                </Text>
              </View>
            )}
            {selectedClub?.sport_types && selectedClub.sport_types.length > 0 && (
              <Text variant="caption" muted style={styles.modalSports}>
                {selectedClub.sport_types.join(" · ")}
              </Text>
            )}

            <View style={styles.modalDivider} />

            {/* Estado: ya es socio */}
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

                  {/* DNI opcional */}
                  <Text variant="label" style={styles.dniLabel}>
                    DNI (opcional)
                  </Text>
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

// ══════════════════════════════════════════════════════════════
// MEMBER DASHBOARD — Panel del socio activo
// ══════════════════════════════════════════════════════════════

// ── Sub-componentes del dashboard ─────────────────────────────

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

function ReservationTicket({ item }: { item: UpcomingReservation }) {
  const statusColor = STATUS_COLOR[item.status];
  const statusLabel = STATUS_LABEL[item.status];

  return (
    <Card padding={0} style={styles.ticketCard}>
      <View style={styles.ticketInner}>
        <View style={[styles.ticketAccent, { backgroundColor: statusColor }]} />
        <View style={styles.ticketBody}>
          <View style={styles.ticketHeaderRow}>
            <Text variant="subheading" weight="700" style={styles.courtName} numberOfLines={1}>
              {item.courtName}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
              <Text variant="label" style={{ color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>
          <Text variant="caption" muted style={styles.sportLabel}>{item.sport}</Text>
          <View style={styles.scheduleRow}>
            <Feather name="calendar" size={12} color={Colors.textMuted} />
            <Text variant="caption" muted style={styles.scheduleText}>{item.date}</Text>
            <Feather name="clock" size={12} color={Colors.textMuted} style={styles.scheduleIconGap} />
            <Text variant="caption" muted style={styles.scheduleText}>{item.timeRange}</Text>
          </View>
          {item.price > 0 && (
            <Text variant="caption" weight="600" style={styles.ticketPrice}>
              ${item.price.toLocaleString("es-AR")}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function TournamentCard({ item }: { item: TournamentItem }) {
  const pct = ((item.total_spots - item.spots) / item.total_spots) * 100;

  return (
    <Card
      onPress={() => {}}
      style={{ backgroundColor: item.color, padding: 0, width: 220, overflow: "hidden" }}
    >
      <Image source={{ uri: item.image }} style={styles.tournamentImage} />
      <View style={styles.tournamentBody}>
        <View style={[styles.sportPill, { backgroundColor: item.accentColor + "18" }]}>
          <Text variant="label" style={{ color: item.accentColor }}>{item.sport}</Text>
        </View>
        <Text variant="subheading" style={styles.tournamentName}>{item.name}</Text>
        <Text variant="caption" muted>{item.date}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%` as `${number}%`, backgroundColor: item.accentColor },
            ]}
          />
        </View>
        <Text variant="label" muted>{item.spots} lugares disponibles</Text>
      </View>
    </Card>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Card onPress={() => {}} padding={14}>
      <View style={styles.newsHeader}>
        <View style={styles.newsTagPill}>
          <Text variant="label" style={styles.newsTagText}>{item.tag}</Text>
        </View>
        <Text variant="caption">{item.date}</Text>
      </View>
      <Text variant="subheading" style={styles.newsTitle}>{item.title}</Text>
      <Text variant="body" muted style={styles.newsBody} numberOfLines={2}>{item.body}</Text>
    </Card>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading">{title}</Text>
      {action && (
        <TouchableOpacity activeOpacity={0.7}>
          <Text variant="caption" style={styles.seeAll}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Header del dashboard ───────────────────────────────────────

function DashboardHeader({ firstName, initials }: { firstName: string; initials: string }) {
  const router = useRouter();

  return (
    <>
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

      <View style={styles.searchWrapper}>
        <FakeSearchBar />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActionsScroll}
        contentContainerStyle={styles.quickActions}
      >
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity key={a.label} style={styles.quickBtn} activeOpacity={0.7}>
            <Card padding={0} style={styles.quickIconCard}>
              <Feather name={a.icon} size={20} color={Colors.primary} />
            </Card>
            <Text variant="label" style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader title="Tus Reservas" action="Ver todas →" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {UPCOMING.map((r) => <ReservationTicket key={r.id} item={r} />)}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Torneos" action="Ver todos →" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {TOURNAMENTS.map((t) => <TournamentCard key={t.id} item={t} />)}
        </ScrollView>
      </View>

      <SectionHeader title="Novedades" />
    </>
  );
}

function MemberDashboard() {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const firstName = user?.firstName ?? "";
  const lastName  = user?.lastName  ?? "";
  const initials  = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />
      <FlatList<NewsItem>
        data={NEWS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.newsItemWrapper}>
            <NewsCard item={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.newsSeparator} />}
        ListHeaderComponent={
          <DashboardHeader firstName={firstName} initials={initials} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// HOME SCREEN — Entry point con enrutamiento condicional
// ══════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const { user } = useAuth();

  // Un usuario es "miembro activo" si:
  //   a) tiene al menos una ClubMembership APPROVED (nuevo sistema), O
  //   b) tiene club_id en su perfil (campo legacy — usuarios pre-memberships)
  const hasApprovedMembership =
    (user?.memberships ?? []).some((m) => m.status === "APPROVED") ||
    (user?.clubId != null);

  return hasApprovedMembership ? <MemberDashboard /> : <GuestHome />;
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

  // ── Guest Home ───────────────────────────────────────────────
  guestHeader: {
    paddingHorizontal: 20,
    paddingTop:        22,
    paddingBottom:     4,
  },
  guestTitle: {
    color: Colors.primary,
  },
  guestSearchWrap: {
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     8,
  },
  guestSearch: {
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
  guestSearchIcon:  { marginRight: 10 },
  guestSearchInput: {
    flex:     1,
    color:    Colors.text,
    fontSize: 14,
  },
  clubList: {
    paddingHorizontal: 20,
    paddingTop:        4,
    paddingBottom:     48,
  },
  clubSeparator: {
    height: 10,
  },
  clubCard: {
    // hereda sombra de Card
  },
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
  clubMetaText: {
    marginTop: 1,
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
  emptyContainer: {
    alignItems:   "center",
    paddingTop:   60,
    gap:          12,
  },
  emptyText: {
    textAlign: "center",
  },

  // ── Modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent:  "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.cardBackground,
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
    color:         Colors.primary,
    textAlign:     "center",
    marginBottom:  4,
  },
  modalMeta: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    marginBottom:   4,
  },
  modalMetaText: {
    marginTop: 1,
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
    textAlign:     "center",
    color:         Colors.textMuted,
    marginBottom:  16,
    lineHeight:    20,
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
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    backgroundColor: Colors.successSurface,
    borderRadius:   12,
    padding:        14,
    width:          "100%",
    marginBottom:   16,
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

  // ── Member Dashboard ─────────────────────────────────────────
  listContent: {
    paddingBottom: 48,
  },
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
  quickLabel: {
    color: Colors.textMuted,
  },
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
  tournamentImage: {
    width:  "100%",
    height: 100,
  },
  tournamentBody: {
    padding: 12,
    gap:     5,
  },
  sportPill: {
    alignSelf:         "flex-start",
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      20,
  },
  tournamentName: {
    color: Colors.text,
  },
  progressTrack: {
    height:          4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    2,
    marginTop:       2,
  },
  progressFill: {
    height:       4,
    borderRadius: 2,
  },
  newsItemWrapper: {
    paddingHorizontal: 20,
  },
  newsSeparator: {
    height: 10,
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
});
