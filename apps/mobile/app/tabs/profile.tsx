/**
 * Perfil — Portal del Jugador
 * ============================
 * Pantalla de perfil del socio con menú de opciones y cierre de sesión.
 *
 * Estructura visual:
 *   1. <Card> — Avatar + nombre + email + club
 *   2. <Card> — Menú de opciones (maquetación, sin navegación aún)
 *   3. Botón destructivo "Cerrar sesión" al pie
 *
 * Logout:
 *   Muestra un Alert de confirmación → llama a logout() del AuthContext
 *   (limpia SecureStore + estado global) → router.replace('/') redirige al
 *   index, que al ver token=null reenvía a /(auth)/login automáticamente.
 */

import React, { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Card } from "@/components/Card";
import { useAuth } from "@/context/AuthContext";

// ── Tipos ─────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface MenuItem {
  icon:    FeatherName;
  label:   string;
  danger?: boolean;
}

// ── Datos del menú ────────────────────────────────────────────

const MENU_ITEMS: MenuItem[] = [
  { icon: "user",        label: "Mis Datos"              },
  { icon: "credit-card", label: "Métodos de Pago"        },
  { icon: "bell",        label: "Notificaciones"         },
  { icon: "shield",      label: "Privacidad y Seguridad" },
];

// ── Subcomponentes ────────────────────────────────────────────

function Avatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatarRing}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function MenuRow({ item, isLast }: { item: MenuItem; isLast: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        !isLast && styles.menuRowBorder,
        pressed && styles.menuRowPressed,
      ]}
      accessible
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
    >
      {/* Ícono izquierdo */}
      <View style={styles.menuIconWrap}>
        <Feather
          name={item.icon}
          size={16}
          color={item.danger ? Colors.danger : Colors.primary}
        />
      </View>

      {/* Label */}
      <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
        {item.label}
      </Text>

      {/* Chevron derecho */}
      <Feather name="chevron-right" size={16} color={Colors.placeholder} />
    </Pressable>
  );
}

// ── Pantalla principal ─────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const firstName = user?.firstName ?? "";
  const lastName  = user?.lastName  ?? "";
  const initials  = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const fullName  = `${firstName} ${lastName}`.trim() || "Socio";
  const email     = user?.email    ?? "";
  const clubName  = user?.clubName ?? "ClubSync";

  // ── Logout ────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Cerrar sesión",
      "¿Estás seguro de que querés salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text:    "Cerrar sesión",
          style:   "destructive",
          onPress: async () => {
            await logout();
            // index.tsx detecta token=null y redirige a /(auth)/login
            router.replace("/");
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout, router]);

  // ── Render ────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Mi Perfil</Text>
        </View>

        {/* ── Card: datos del usuario ── */}
        <Card style={styles.userCard} padding={0}>
          <View style={styles.userCardInner}>
            <Avatar initials={initials} />

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>

              {/* Pill del club */}
              <View style={styles.clubPill}>
                <Feather name="map-pin" size={10} color={Colors.primary} />
                <Text style={styles.clubPillText}>{clubName}</Text>
              </View>
            </View>
          </View>

          {/* Divisor + fila de estadísticas rápidas */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Reservas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Activo</Text>
              <Text style={styles.statLabel}>Estado</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Torneos</Text>
            </View>
          </View>
        </Card>

        {/* ── Card: menú de opciones ── */}
        <Card padding={0} style={styles.menuCard}>
          {MENU_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.label}
              item={item}
              isLast={idx === MENU_ITEMS.length - 1}
            />
          ))}
        </Card>

        {/* ── Botón de cierre de sesión ── */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && styles.logoutBtnPressed,
          ]}
          onPress={handleLogout}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Feather name="log-out" size={16} color={Colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        {/* ── Versión de la app ── */}
        <Text style={styles.version}>ClubSync v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,
  },
  scroll: {
    paddingHorizontal: 20,
    gap:               16,
  },

  // Cabecera de página
  pageHeader: {
    paddingTop:    18,
    paddingBottom:  4,
  },
  pageTitle: {
    fontSize:      22,
    fontWeight:    "800",
    color:         Colors.text,
    letterSpacing: -0.4,
  },

  // ── Card usuario ──────────────────────────────────────────

  userCard: {
    overflow: "hidden",
  },
  userCardInner: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           14,
    padding:       20,
  },

  // Avatar
  avatarRing: {
    padding:         3,
    borderRadius:    999,
    borderWidth:     2,
    borderColor:     Colors.primaryBorder,
  },
  avatar: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.text,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarText: {
    color:      Colors.textOnBrand,
    fontSize:   18,
    fontWeight: "700",
  },

  // Info del usuario
  userInfo: {
    flex: 1,
    gap:  4,
  },
  userName: {
    fontSize:      17,
    fontWeight:    "700",
    color:         Colors.text,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 13,
    color:    Colors.textMuted,
  },
  clubPill: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    alignSelf:      "flex-start",
    backgroundColor: Colors.primarySubtle,
    borderRadius:   999,
    paddingHorizontal: 8,
    paddingVertical:    3,
    marginTop:      2,
  },
  clubPillText: {
    fontSize:   11,
    fontWeight: "600",
    color:      Colors.primary,
  },

  // Estadísticas rápidas
  statsRow: {
    flexDirection:   "row",
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
  },
  statItem: {
    flex:           1,
    alignItems:     "center",
    paddingVertical: 14,
    gap:             3,
  },
  statDivider: {
    width:           1,
    backgroundColor: Colors.border,
    marginVertical:  12,
  },
  statValue: {
    fontSize:   15,
    fontWeight: "700",
    color:      Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color:    Colors.textMuted,
  },

  // ── Menú ─────────────────────────────────────────────────

  menuCard: {
    overflow: "hidden",
  },
  menuRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuRowPressed: {
    backgroundColor: Colors.surface,
  },
  menuIconWrap: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: Colors.primarySubtle,
    alignItems:      "center",
    justifyContent:  "center",
  },
  menuLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: "500",
    color:      Colors.text,
  },
  menuLabelDanger: {
    color: Colors.danger,
  },

  // ── Logout ───────────────────────────────────────────────

  logoutBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    height:          50,
    borderRadius:    14,
    borderWidth:     1.5,
    borderColor:     Colors.danger + "40",
    backgroundColor: Colors.dangerSurface,
    marginTop:       4,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.danger,
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius:  6,
      },
    }),
  },
  logoutBtnPressed: {
    backgroundColor: Colors.danger + "18",
    borderColor:     Colors.danger + "80",
  },
  logoutText: {
    fontSize:   15,
    fontWeight: "600",
    color:      Colors.danger,
  },

  // ── Versión ───────────────────────────────────────────────

  version: {
    textAlign: "center",
    fontSize:  12,
    color:     Colors.placeholder,
    marginTop: 4,
  },
});
