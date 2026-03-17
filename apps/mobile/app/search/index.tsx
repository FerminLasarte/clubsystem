// apps/mobile/app/search/index.tsx
// Pantalla dedicada de búsqueda — destino del fake search bar

import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Mock search results ───────────────────────────────────────
type ResultType = "court" | "member" | "tournament";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
}

const ALL_RESULTS: SearchResult[] = [
  { id: "c1", type: "court", title: "Cancha 1 — Pádel cubierta", subtitle: "Disponible hoy 18 h · $3.500/h" },
  { id: "c2", type: "court", title: "Cancha 3 — Tenis tierra", subtitle: "Disponible mañana 10 h · $2.800/h" },
  { id: "c3", type: "court", title: "Cancha 5 — Fútbol 5", subtitle: "Sin disponibilidad hoy" },
  { id: "m1", type: "member", title: "Ana García", subtitle: "Socia activa · Pádel" },
  { id: "m2", type: "member", title: "Luis Fernández", subtitle: "Socio activo · Tenis" },
  { id: "t1", type: "tournament", title: "Torneo Dobles Pádel", subtitle: "22–24 jun · 4 cupos" },
  { id: "t2", type: "tournament", title: "Open Tenis Sub-18", subtitle: "30 jun · 8 cupos" },
];

const RECENT: string[] = ["Cancha 1", "Torneo pádel", "Ana García"];

const TYPE_CONFIG: Record<ResultType, { icon: string; color: string; bg: string }> = {
  court:      { icon: "map-pin",  color: "#0284C7", bg: "#EFF6FF" },
  member:     { icon: "user",     color: "#7C3AED", bg: "#F5F3FF" },
  tournament: { icon: "award",    color: "#B45309", bg: "#FFFBEB" },
};

function ResultItem({ item }: { item: SearchResult }) {
  const cfg = TYPE_CONFIG[item.type];
  return (
    <TouchableOpacity style={styles.resultItem} activeOpacity={0.75}>
      <View style={[styles.resultIcon, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon as any} size={16} color={cfg.color} />
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={14} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");

  // Auto-focus when screen mounts — this is why we need a dedicated screen
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const results = query.length > 1
    ? ALL_RESULTS.filter((r) =>
        r.title.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const showRecent = query.length === 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Search bar + cancel */}
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Feather name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar canchas, socios, torneos…"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ResultItem item={item} />}
        ListHeaderComponent={
          showRecent ? (
            <View>
              <Text style={styles.sectionLabel}>Búsquedas recientes</Text>
              {RECENT.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.recentItem}
                  onPress={() => setQuery(r)}
                >
                  <Feather name="clock" size={14} color="#9CA3AF" />
                  <Text style={styles.recentText}>{r}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                Explorar
              </Text>
              {(["court", "member", "tournament"] as ResultType[]).map((type) => {
                const cfg = TYPE_CONFIG[type];
                const label = { court: "Canchas", member: "Socios", tournament: "Torneos" }[type];
                return (
                  <TouchableOpacity key={type} style={styles.exploreItem} activeOpacity={0.75}>
                    <View style={[styles.resultIcon, { backgroundColor: cfg.bg }]}>
                      <Feather name={cfg.icon as any} size={16} color={cfg.color} />
                    </View>
                    <Text style={styles.exploreLabel}>{label}</Text>
                    <Feather name="chevron-right" size={14} color="#D1D5DB" />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : results.length > 0 ? (
            <Text style={styles.sectionLabel}>
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </Text>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="search" size={32} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptySubtitle}>
                Probá con otro término de búsqueda.
              </Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
  },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, color: "#6B7280" },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  recentText: { fontSize: 14, color: "#374151" },

  exploreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  exploreLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: "#111827" },

  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  resultSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  emptyState: {
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
});
