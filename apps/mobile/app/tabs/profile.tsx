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
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
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
        <Text variant="heading" weight="700" color={Colors.textOnBrand} style={styles.avatarText}>
          {initials}
        </Text>
      </View>
    </View>
  );
}

function ProfileOptionRow({ item, isLast }: { item: MenuItem; isLast: boolean }) {
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
      <Text
        variant="subheading"
        style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}
      >
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

      {/* ── Cabecera unificada (fuera del scroll para que sea consistente) ── */}
      <PageHeader title="Mi Perfil" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Card: datos del usuario ── */}
        <Card style={styles.userCard} padding={0}>
          <View style={styles.userCardInner}>
            <Avatar initials={initials} />

            <View style={styles.userInfo}>
              <Text variant="subheading" weight="700" style={styles.userName}>{fullName}</Text>
              <Text variant="caption" muted style={styles.userEmail} numberOfLines={1}>{email}</Text>

              {/* Pill del club */}
              <View style={styles.clubPill}>
                <Feather name="map-pin" size={10} color={Colors.primary} />
                <Text variant="label" style={styles.clubPillText}>{clubName}</Text>
              </View>
            </View>
          </View>

          {/* Divisor + fila de estadísticas rápidas */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="subheading" weight="700" style={styles.statValue}>—</Text>
              <Text variant="label" muted style={styles.statLabel}>Reservas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="subheading" weight="700" style={styles.statValue}>Activo</Text>
              <Text variant="label" muted style={styles.statLabel}>Estado</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="subheading" weight="700" style={styles.statValue}>—</Text>
              <Text variant="label" muted style={styles.statLabel}>Torneos</Text>
            </View>
          </View>
        </Card>

        {/* ── Card: menú de opciones ── */}
        <Card padding={0} style={styles.menuCard}>
          {MENU_ITEMS.map((item, idx) => (
            <ProfileOptionRow
              key={item.label}
              item={item}
              isLast={idx === MENU_ITEMS.length - 1}
            />
          ))}
        </Card>

        {/* ── Card: cierre de sesión ── */}
        <Card padding={0} style={styles.logoutCard}>
          {/* Divisor sutil que separa visualmente la zona de peligro */}
          <View style={styles.logoutDivider} />
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
            <Feather name="log-out" size={16} color="#FFFFFF" />
            <Text variant="subheading" weight="600" style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </Card>

        {/* ── Versión de la app ── */}
        <Text variant="label" muted style={styles.version}>ClubSync v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.appBackground,  // blanco puro — sombra de Cards da el contraste
  },
  scroll: {
    paddingHorizontal: 20,
    gap:               16,
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
    backgroundColor: Colors.primary,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarText: {
    // color viene de la prop color={Colors.textOnBrand} en el componente Text
  },

  // Info del usuario
  userInfo: {
    flex: 1,
    gap:  4,
  },
  userName: {
    color: Colors.text,
  },
  userEmail: {
    color: Colors.textMuted,
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
    color: Colors.primary,
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
    color: Colors.text,
  },
  statLabel: {
    color: Colors.textMuted,
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
    flex:  1,
    color: Colors.text,
  },
  menuLabelDanger: {
    color: Colors.danger,
  },

  // ── Logout ───────────────────────────────────────────────

  logoutCard: {
    overflow:        "hidden",
    marginTop:       24,
    backgroundColor: Colors.danger,   // fondo rojo sólido — botón destructivo
  },
  logoutDivider: {
    // ya no necesario con fondo rojo sólido
    height: 0,
  },
  logoutBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    height:         54,
  },
  logoutBtnPressed: {
    backgroundColor: Colors.danger + "CC",  // rojo ligeramente más oscuro en press
  },
  logoutText: {
    color: "#FFFFFF",
  },

  // ── Versión ───────────────────────────────────────────────

  version: {
    textAlign: "center",
    color:     Colors.placeholder,
    marginTop: 4,
  },
});
