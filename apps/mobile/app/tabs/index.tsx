// apps/mobile/app/tabs/index.tsx
// Home screen — Portal del Jugador (estética premium Stripe)

import React, { useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { useAuth } from "@/context/AuthContext";

// ── Mock data ──────────────────────────────────────────────────

const TOURNAMENTS = [
  {
    id: "1",
    name: "Torneo Dobles Pádel",
    date: "22–24 jun",
    sport: "Pádel",
    spots: 4,
    total_spots: 16,
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400",
    color: "#EBF8FF",
    accentColor: "#2B6CB0",
  },
  {
    id: "2",
    name: "Open de Tenis Sub-18",
    date: "30 jun",
    sport: "Tenis",
    spots: 8,
    total_spots: 32,
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400",
    color: "#F0FFF4",
    accentColor: "#276749",
  },
];

const NEWS = [
  {
    id: "1",
    title: "Nuevos horarios de canchas cubiertas",
    body: "A partir del 1 de julio, las canchas 5 y 6 habilitarán franjas nocturnas hasta las 23 h.",
    date: "Hace 2 días",
    tag: "Aviso",
  },
  {
    id: "2",
    title: "Clase de iniciación al pádel — Julio",
    body: "Inscribite antes del 20/6. Cupos limitados a 8 personas. Incluye raqueta prestada.",
    date: "Hace 4 días",
    tag: "Clases",
  },
  {
    id: "3",
    title: "Mantenimiento preventivo — domingo 16 jun",
    body: "Las canchas 1 a 3 estarán fuera de servicio de 08:00 a 12:00 h.",
    date: "Hace 1 semana",
    tag: "Mantenimiento",
  },
];

// ── Quick actions ──────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: "calendar",  label: "Reservar"   },
  { icon: "clock",     label: "Mis turnos" },
  { icon: "users",     label: "Socios"     },
  { icon: "award",     label: "Torneos"    },
] as const;

// ── Fake Search Bar ────────────────────────────────────────────

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
        <Text style={styles.fakeSearchText}>Buscar canchas, socios, torneos…</Text>
        <View style={styles.fakeSearchKbd}>
          <Text style={styles.fakeSearchKbdText}>⌘K</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Tournament Card ────────────────────────────────────────────

function TournamentCard({ item }: { item: (typeof TOURNAMENTS)[0] }) {
  const pct = ((item.total_spots - item.spots) / item.total_spots) * 100;

  return (
    <Card
      onPress={() => {}}
      style={{ backgroundColor: item.color, padding: 0, width: 230, overflow: "hidden" }}
    >
      <Image source={{ uri: item.image }} style={styles.tournamentImage} />
      <View style={styles.tournamentBody}>
        <View style={[styles.sportPill, { backgroundColor: item.accentColor + "18" }]}>
          <Text style={[styles.sportPillText, { color: item.accentColor }]}>
            {item.sport}
          </Text>
        </View>
        <Text style={styles.tournamentName}>{item.name}</Text>
        <Text style={styles.tournamentDate}>{item.date}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%` as any, backgroundColor: item.accentColor },
            ]}
          />
        </View>
        <Text style={styles.spotsText}>{item.spots} lugares disponibles</Text>
      </View>
    </Card>
  );
}

// ── News Card ──────────────────────────────────────────────────

function NewsCard({ item }: { item: (typeof NEWS)[0] }) {
  return (
    <Card onPress={() => {}} padding={14}>
      <View style={styles.newsHeader}>
        <View style={styles.newsTagPill}>
          <Text style={styles.newsTagText}>{item.tag}</Text>
        </View>
        <Text style={styles.newsDate}>{item.date}</Text>
      </View>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <Text style={styles.newsBody} numberOfLines={2}>{item.body}</Text>
    </Card>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function HomeScreen() {
  const insets    = useSafeAreaInsets();
  const { user }  = useAuth();

  const firstName = user?.firstName ?? "";
  const lastName  = user?.lastName  ?? "";
  const initials  = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hola 👋</Text>
            <Text style={styles.memberName}>{firstName} {lastName}</Text>
          </View>

          <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Búsqueda ── */}
        <View style={styles.searchWrapper}>
          <FakeSearchBar />
        </View>

        {/* ── Acciones rápidas ── */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickBtn} activeOpacity={0.7}>
              <Card padding={0} style={styles.quickIconCard}>
                <Feather name={a.icon} size={18} color={Colors.text} />
              </Card>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Torneos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Torneos próximos</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {TOURNAMENTS.map((t) => (
              <TournamentCard key={t.id} item={t} />
            ))}
          </ScrollView>
        </View>

        {/* ── Novedades ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Novedades</Text>
          </View>
          <View style={styles.newsList}>
            {NEWS.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.appBackground,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Cabecera
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 20,
    paddingTop:  18,
    paddingBottom: 6,
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    fontSize:   13,
    color:      Colors.textMuted,
    fontWeight: "500",
  },
  memberName: {
    fontSize:      20,
    fontWeight:    "700",
    color:         Colors.text,
    letterSpacing: -0.3,
  },
  avatarWrap: {},
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.text,
    justifyContent:  "center",
    alignItems:      "center",
  },
  avatarText: {
    color:      Colors.textOnBrand,
    fontSize:   13,
    fontWeight: "700",
  },

  // Búsqueda
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop:   12,
    paddingBottom: 8,
  },
  fakeSearch: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: Colors.cardBackground,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
    // Sombra sutil sobre el lienzo gris
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
    flex:     1,
    fontSize: 14,
    color:    Colors.placeholder,
  },
  fakeSearchKbd: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  fakeSearchKbdText: {
    fontSize:   10,
    color:      Colors.textMuted,
    fontWeight: "600",
  },

  // Acciones rápidas
  quickActions: {
    flexDirection:  "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop:  16,
    paddingBottom: 24,
  },
  quickBtn: {
    alignItems: "center",
    gap: 8,
  },
  quickIconCard: {
    width:           56,
    height:          56,
    borderRadius:    16,
    justifyContent:  "center",
    alignItems:      "center",
  },
  quickLabel: {
    fontSize:   11,
    color:      Colors.textMuted,
    fontWeight: "500",
  },

  // Secciones
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize:      16,
    fontWeight:    "700",
    color:         Colors.text,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize:   13,
    color:      Colors.textMuted,
    fontWeight: "500",
  },

  // Torneos
  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tournamentImage: {
    width:  "100%",
    height: 110,
  },
  tournamentBody: {
    padding: 14,
    gap:     6,
  },
  sportPill: {
    alignSelf:         "flex-start",
    paddingHorizontal: 10,
    paddingVertical:    3,
    borderRadius:      20,
  },
  sportPillText: {
    fontSize:   11,
    fontWeight: "700",
  },
  tournamentName: {
    fontSize:   14,
    fontWeight: "700",
    color:      Colors.text,
  },
  tournamentDate: {
    fontSize: 12,
    color:    Colors.textMuted,
  },
  progressTrack: {
    height:          4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    2,
    marginTop:       4,
  },
  progressFill: {
    height:       4,
    borderRadius: 2,
  },
  spotsText: {
    fontSize: 11,
    color:    Colors.textMuted,
  },

  // Novedades
  newsList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  newsHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   6,
  },
  newsTagPill: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      6,
  },
  newsTagText: {
    fontSize:   11,
    fontWeight: "600",
    color:      Colors.textMuted,
  },
  newsDate: {
    fontSize: 11,
    color:    Colors.placeholder,
  },
  newsTitle: {
    fontSize:   14,
    fontWeight: "700",
    color:      Colors.text,
    lineHeight: 20,
  },
  newsBody: {
    fontSize:   13,
    color:      Colors.textMuted,
    lineHeight: 19,
    marginTop:  2,
  },
});
