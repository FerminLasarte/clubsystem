// apps/mobile/app/(tabs)/index.tsx
// Home screen — Novedades y torneos con FAKE SEARCH BAR

import React, { useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
  Animated,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Mock data ────────────────────────────────────────────────
const TOURNAMENTS = [
  {
    id: "1",
    name: "Torneo Dobles Pádel",
    date: "22–24 jun",
    sport: "Pádel",
    spots: 4,
    total_spots: 16,
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400",
    color: "#F0F9FF",
    accentColor: "#0284C7",
  },
  {
    id: "2",
    name: "Open de Tenis Sub-18",
    date: "30 jun",
    sport: "Tenis",
    spots: 8,
    total_spots: 32,
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400",
    color: "#F7FEE7",
    accentColor: "#65A30D",
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

// ── Fake Search Bar ───────────────────────────────────────────
function FakeSearchBar() {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const handlePressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => router.push("/search")}
      accessible
      accessibilityRole="search"
      accessibilityLabel="Buscar canchas, socios o torneos"
    >
      <Animated.View
        style={[styles.fakeSearch, { transform: [{ scale: scaleAnim }] }]}
      >
        <Feather name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <Text style={styles.fakeSearchText}>
          Buscar canchas, socios, torneos…
        </Text>
        <View style={styles.fakeSearchKbd}>
          <Text style={styles.fakeSearchKbdText}>⌘K</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Tournament Card ───────────────────────────────────────────
function TournamentCard({ item }: { item: (typeof TOURNAMENTS)[0] }) {
  const pct = ((item.total_spots - item.spots) / item.total_spots) * 100;

  return (
    <TouchableOpacity style={[styles.tournamentCard, { backgroundColor: item.color }]} activeOpacity={0.85}>
      <Image source={{ uri: item.image }} style={styles.tournamentImage} />
      <View style={styles.tournamentBody}>
        <View style={[styles.sportPill, { backgroundColor: item.accentColor + "20" }]}>
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
        <Text style={styles.spotsText}>
          {item.spots} lugares disponibles
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── News Card ─────────────────────────────────────────────────
function NewsCard({ item }: { item: (typeof NEWS)[0] }) {
  return (
    <TouchableOpacity style={styles.newsCard} activeOpacity={0.8}>
      <View style={styles.newsHeader}>
        <View style={styles.newsTagPill}>
          <Text style={styles.newsTagText}>{item.tag}</Text>
        </View>
        <Text style={styles.newsDate}>{item.date}</Text>
      </View>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <Text style={styles.newsBody} numberOfLines={2}>{item.body}</Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Buenos días 👋</Text>
            <Text style={styles.memberName}>Carlos Rodríguez</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>CR</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── FAKE SEARCH BAR ── */}
        <View style={styles.searchWrapper}>
          <FakeSearchBar />
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {[
            { icon: "calendar", label: "Reservar" },
            { icon: "clock", label: "Mis turnos" },
            { icon: "users", label: "Socios" },
            { icon: "award", label: "Torneos" },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickBtn} activeOpacity={0.75}>
              <View style={styles.quickIcon}>
                <Feather name={a.icon as any} size={18} color="#111827" />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tournaments section */}
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

        {/* News section */}
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

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 13, color: "#6B7280" },
  memberName: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 2 },
  avatarBtn: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Fake search
  searchWrapper: { paddingHorizontal: 20, paddingVertical: 12 },
  fakeSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
  },
  searchIcon: { marginRight: 10 },
  fakeSearchText: { flex: 1, fontSize: 14, color: "#9CA3AF" },
  fakeSearchKbd: {
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fakeSearchKbdText: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  quickBtn: { alignItems: "center", gap: 8 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  quickLabel: { fontSize: 11, color: "#6B7280", fontWeight: "500" },

  // Sections
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  seeAll: { fontSize: 13, color: "#6B7280" },

  // Tournaments
  horizontalList: { paddingHorizontal: 20, gap: 12 },
  tournamentCard: {
    width: 240,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tournamentImage: { width: "100%", height: 120 },
  tournamentBody: { padding: 14, gap: 6 },
  sportPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  sportPillText: { fontSize: 11, fontWeight: "700" },
  tournamentName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tournamentDate: { fontSize: 12, color: "#6B7280" },
  progressTrack: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 4,
  },
  progressFill: { height: 4, borderRadius: 2 },
  spotsText: { fontSize: 11, color: "#6B7280" },

  // News
  newsList: { paddingHorizontal: 20, gap: 10 },
  newsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 6,
  },
  newsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  newsTagPill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newsTagText: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  newsDate: { fontSize: 11, color: "#9CA3AF" },
  newsTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  newsBody: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
});
