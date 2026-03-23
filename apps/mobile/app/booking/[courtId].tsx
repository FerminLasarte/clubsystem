/**
 * Motor de Reservas — Pantalla Unificada por Deporte
 * ====================================================
 * Recibe el key del deporte como parámetro (`courtId`).
 *
 * Flujo:
 *   1. Carga canchas del deporte para los clubs del usuario.
 *   2. Si hay > 1 cancha → selector horizontal compacto ("pastillas").
 *   3. Selector de duración: 60 / 90 / 120 min (toggle group).
 *   4. Tira de fechas compacta (14 días, width fijo → sin layout shift).
 *   5. Grilla en intervalos de 30 min:
 *      • Siempre fetcha base=30 min del backend.
 *      • Calcula client-side si hay bloques consecutivos suficientes.
 *      • Slots insuficientes → deshabilitados (opacidad baja).
 *   6. Footer absolute de confirmación → POST /mobile/reservations.
 *
 * Bugfix is_member:
 *   El flag se deriva del AuthContext (memberships APPROVED + legacy club_id),
 *   no del campo is_member de la respuesta de canchas (que no tenía fallback legacy).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/utils/api";

// ── Tipos ─────────────────────────────────────────────────────

/** Cancha enriquecida con el clubId del que fue obtenida (uso interno) */
interface CourtItem {
  id:        string;
  name:      string;
  sport:     string;
  surface:   string | null;
  is_indoor: boolean;
  price:     number;   // hourly rate ya resuelto (member/guest)
  _clubId:   string;   // club de origen (para calcular is_member en frontend)
}

interface TimeSlot {
  start_time:   string;  // "HH:MM"
  end_time:     string;
  is_available: boolean;
  price:        number;  // precio del bloque de 30 min
}

interface CourtAvailability {
  court_id:   string;
  court_name: string;
  sport:      string;
  date:       string;
  is_member:  boolean;
  slots:      TimeSlot[];
}

/** Slot procesado listo para renderizar */
interface ProcessedSlot extends TimeSlot {
  canSelect:      boolean;  // tiene suficientes bloques consecutivos libres
  displayEndTime: string;   // start + selectedDuration
  totalPrice:     number;   // price30 * blocksNeeded
}

type DurationOption = 60 | 90 | 120;

// ── Helpers ───────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  tennis:     "Tenis",
  padel:      "Pádel",
  football:   "Fútbol",
  basketball: "Básquet",
  hockey:     "Hockey",
  volleyball: "Vóley",
  other:      "Otro",
};

const DAYS_ES   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun",
                   "jul", "ago", "sep", "oct", "nov", "dic"];

const DURATION_OPTIONS: DurationOption[] = [60, 90, 120];

function buildDateList(count = 14): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function datePillLabel(d: Date, idx: number): { top: string; bottom: string } {
  if (idx === 0) return { top: "Hoy",    bottom: String(d.getDate()) };
  if (idx === 1) return { top: "Mañana", bottom: String(d.getDate()) };
  return { top: DAYS_ES[d.getDay()], bottom: String(d.getDate()) };
}

/** Suma `mins` a un string "HH:MM" y devuelve "HH:MM" */
function addMins(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ── Pantalla ──────────────────────────────────────────────────

export default function UnifiedBookingScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { user } = useAuth();

  // El parámetro de ruta "courtId" actúa como sport key
  const { courtId: sportKey } = useLocalSearchParams<{ courtId: string }>();
  const sport      = sportKey ?? "other";
  const sportLabel = SPORT_LABELS[sport] ?? sport;

  // ── Estado: canchas ───────────────────────────────────────
  const [courts,          setCourts]          = useState<CourtItem[]>([]);
  const [courtsLoading,   setCourtsLoading]   = useState(true);
  const [courtsError,     setCourtsError]     = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  // ── Estado: disponibilidad ────────────────────────────────
  const dates    = useRef(buildDateList(14)).current;
  const [dateIdx,       setDateIdx]       = useState(0);
  const [availability,  setAvailability]  = useState<CourtAvailability | null>(null);
  const [slotsLoading,  setSlotsLoading]  = useState(false);
  const [slotsError,    setSlotsError]    = useState<string | null>(null);
  const [selectedSlot,  setSelectedSlot]  = useState<TimeSlot | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // ── Duración seleccionada ─────────────────────────────────
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);

  const selectedDate = dates[dateIdx];
  const activeCourt  = courts.find((c) => c.id === selectedCourtId) ?? null;

  // ── is_member fiable desde el contexto de autenticación ──
  // Evita depender del campo is_member de la API de canchas (que no tenía
  // fallback para usuarios con club_id legacy asignado directamente).
  const isMember = useMemo(() => {
    if (!activeCourt || !user) return false;
    const cid = activeCourt._clubId;
    return (
      (user.memberships ?? []).some((m) => m.clubId === cid && m.status === "APPROVED")
      || user.clubId === cid
    );
  }, [activeCourt, user]);

  // ── Slots procesados: disponibilidad para la duración elegida ─
  const processedSlots = useMemo((): ProcessedSlot[] => {
    const raw = availability?.slots ?? [];
    const blocksNeeded = selectedDuration / 30;

    return raw.map((slot, idx) => {
      let canSelect = true;
      for (let k = 0; k < blocksNeeded; k++) {
        const s = raw[idx + k];
        if (!s || !s.is_available) { canSelect = false; break; }
      }
      return {
        ...slot,
        canSelect,
        displayEndTime: addMins(slot.start_time, selectedDuration),
        totalPrice:     slot.price * blocksNeeded,
      };
    });
  }, [availability, selectedDuration]);

  const hasCheckout    = selectedSlot !== null;
  const availableCount = processedSlots.filter((s) => s.canSelect).length;

  // ── Resetear slot al cambiar duración ────────────────────
  useEffect(() => { setSelectedSlot(null); }, [selectedDuration]);

  // ── Cargar canchas del deporte ────────────────────────────

  const loadCourts = useCallback(async () => {
    if (!user) return;
    setCourtsLoading(true);
    setCourtsError(null);

    const clubIds = [
      ...(user.memberships ?? [])
        .filter((m) => m.status === "APPROVED")
        .map((m) => m.clubId),
      ...(user.clubId ? [user.clubId] : []),
    ].filter((id, i, arr) => arr.indexOf(id) === i);

    if (clubIds.length === 0) {
      setCourts([]);
      setCourtsLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        clubIds.map((clubId) =>
          apiClient
            .get<Omit<CourtItem, "_clubId">[]>(`/mobile/clubs/${clubId}/courts`)
            .then((list) => list.map((c) => ({ ...c, _clubId: clubId })))
        )
      );
      const filtered = results.flat().filter((c) => c.sport === sport);
      setCourts(filtered);
      if (filtered.length > 0) setSelectedCourtId(filtered[0].id);
    } catch (err) {
      setCourtsError(err instanceof Error ? err.message : "Error al cargar canchas");
    } finally {
      setCourtsLoading(false);
    }
  }, [user, sport]);

  useEffect(() => { loadCourts(); }, [loadCourts]);

  // ── Fetch disponibilidad (base 30 min siempre) ────────────

  const fetchAvailability = useCallback(
    async (courtId: string, idx: number) => {
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);
      const dateStr = formatDateParam(dates[idx]);
      try {
        const data = await apiClient.get<CourtAvailability>(
          `/mobile/courts/${courtId}/availability?date=${dateStr}&duration=30`
        );
        setAvailability(data);
      } catch (err) {
        setSlotsError(err instanceof Error ? err.message : "Error al cargar disponibilidad");
      } finally {
        setSlotsLoading(false);
      }
    },
    [dates]
  );

  useEffect(() => {
    if (selectedCourtId) fetchAvailability(selectedCourtId, dateIdx);
  }, [selectedCourtId, dateIdx, fetchAvailability]);

  // ── Confirmar reserva ─────────────────────────────────────

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedCourtId || !activeCourt) return;
    const endTime = addMins(selectedSlot.start_time, selectedDuration);
    const blocksNeeded = selectedDuration / 30;
    const total = selectedSlot.price * blocksNeeded;

    setIsSubmitting(true);
    try {
      await apiClient.post("/mobile/reservations", {
        court_id:   selectedCourtId,
        date:       formatDateParam(selectedDate),
        start_time: selectedSlot.start_time,
        duration:   selectedDuration,
      });
      Alert.alert(
        "¡Reserva solicitada!",
        `${activeCourt.name}\n${selectedSlot.start_time} – ${endTime}\n$${total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
        [{ text: "Ver mis turnos", onPress: () => router.replace("/tabs/reservations") }]
      );
    } catch (err) {
      Alert.alert(
        "No se pudo reservar",
        err instanceof Error ? err.message : "Intentá de nuevo más tarde."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text variant="subheading" weight="700" style={styles.courtNameText} numberOfLines={1}>
            {activeCourt?.name ?? sportLabel}
          </Text>
          <Text variant="label" muted numberOfLines={1}>
            {sportLabel}
            {activeCourt ? (isMember ? " · Precio socio" : " · Precio visitante") : ""}
          </Text>
        </View>

        {!slotsLoading && !courtsLoading && availableCount > 0 && (
          <View style={styles.availPill}>
            <Text variant="label" style={styles.availText}>
              {availableCount} {availableCount === 1 ? "libre" : "libres"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Carga de canchas ── */}
      {courtsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : courtsError ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={Colors.danger} />
          <Text variant="body" muted style={styles.centeredText}>{courtsError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCourts} activeOpacity={0.8}>
            <Text variant="caption" weight="600" style={{ color: Colors.primary }}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : courts.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="grid" size={36} color={Colors.surfaceRaised} />
          <Text variant="body" muted style={styles.centeredText}>
            No hay canchas de {sportLabel} disponibles en tus clubs
          </Text>
        </View>
      ) : (
        <>
          {/* ── Selector de cancha (pastillas compactas) ── */}
          {courts.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.courtStrip}
            >
              {courts.map((court) => {
                const isActive = court.id === selectedCourtId;
                return (
                  <TouchableOpacity
                    key={court.id}
                    style={[styles.courtPill, isActive && styles.courtPillActive]}
                    onPress={() => {
                      setSelectedCourtId(court.id);
                      setSelectedSlot(null);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      variant="caption"
                      weight="600"
                      style={[styles.courtPillText, isActive && styles.courtPillTextActive]}
                      numberOfLines={1}
                    >
                      {court.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ── Selector de duración ── */}
          <View style={styles.durationRow}>
            <Text variant="label" muted style={styles.durationLabel}>Duración</Text>
            <View style={styles.durationGroup}>
              {DURATION_OPTIONS.map((d) => {
                const active = d === selectedDuration;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationPill, active && styles.durationPillActive]}
                    onPress={() => setSelectedDuration(d)}
                    activeOpacity={0.7}
                  >
                    <Text
                      variant="caption"
                      weight="600"
                      style={[styles.durationText, active && styles.durationTextActive]}
                    >
                      {d} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Tira de fechas (width fijo → sin layout shift) ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateStrip}
          >
            {dates.map((d, idx) => {
              const { top, bottom } = datePillLabel(d, idx);
              const isActive = idx === dateIdx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.datePill, isActive && styles.datePillActive]}
                  onPress={() => setDateIdx(idx)}
                  activeOpacity={0.75}
                >
                  <Text
                    variant="label"
                    weight="600"
                    style={[styles.datePillTop, isActive && styles.dateTextActive]}
                  >
                    {top}
                  </Text>
                  <Text
                    variant="subheading"
                    weight="700"
                    style={[styles.datePillBottom, isActive && styles.dateTextActive]}
                  >
                    {bottom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Grilla de horarios (intervalos de 30 min) ── */}
          {slotsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : slotsError ? (
            <View style={styles.centered}>
              <Feather name="alert-circle" size={32} color={Colors.danger} />
              <Text variant="body" muted style={styles.centeredText}>{slotsError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => selectedCourtId && fetchAvailability(selectedCourtId, dateIdx)}
                activeOpacity={0.8}
              >
                <Text variant="caption" weight="600" style={{ color: Colors.primary }}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={processedSlots}
              keyExtractor={(item) => item.start_time}
              numColumns={2}
              columnWrapperStyle={styles.slotRow}
              style={styles.slotFlatList}
              contentContainerStyle={[
                styles.slotList,
                hasCheckout && { paddingBottom: insets.bottom + 120 },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptySlots}>
                  <Feather name="clock" size={32} color={Colors.surfaceRaised} />
                  <Text variant="body" muted style={styles.centeredText}>
                    No hay horarios disponibles para este día
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedSlot?.start_time === item.start_time;
                // Deshabilitado si el slot base no está libre O si no hay suficientes bloques consecutivos
                const isDisabled = !item.is_available || !item.canSelect;

                return (
                  <Pressable
                    style={[
                      styles.slotCard,
                      isDisabled  && styles.slotCardDisabled,
                      isSelected  && styles.slotCardSelected,
                    ]}
                    onPress={() => {
                      if (isDisabled) return;
                      setSelectedSlot(isSelected ? null : item);
                    }}
                    disabled={isDisabled}
                  >
                    {isSelected && (
                      <View style={styles.slotCheck}>
                        <Feather name="check" size={11} color="#FFFFFF" />
                      </View>
                    )}

                    <Text
                      variant="subheading"
                      weight="700"
                      style={[
                        styles.slotTime,
                        isDisabled && styles.slotTextDisabled,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      {item.start_time}
                    </Text>

                    <Text
                      variant="label"
                      style={[
                        styles.slotEnd,
                        isDisabled && styles.slotTextDisabled,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      → {item.displayEndTime}
                    </Text>

                    {isDisabled ? (
                      <Text variant="label" style={styles.occupiedLabel}>
                        {item.is_available ? "Insuficiente" : "Ocupado"}
                      </Text>
                    ) : (
                      <Text
                        variant="label"
                        weight="600"
                        style={[styles.slotPrice, isSelected && styles.slotTextSelected]}
                      >
                        ${item.totalPrice.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Checkout bar (position: absolute → no squish) ── */}
      {hasCheckout && selectedSlot && activeCourt && (
        <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.checkoutInfo}>
            <Text variant="label" muted style={styles.checkoutDateLabel}>
              {DAYS_ES[selectedDate.getDay()]} {selectedDate.getDate()} {MONTHS_ES[selectedDate.getMonth()]}
            </Text>
            <Text variant="subheading" weight="700" style={{ color: Colors.text }}>
              {selectedSlot.start_time} – {addMins(selectedSlot.start_time, selectedDuration)}
            </Text>
          </View>

          <View style={styles.checkoutPrice}>
            <Text variant="label" muted>Total</Text>
            <Text variant="heading" weight="700" style={{ color: Colors.primary }}>
              ${(selectedSlot.price * (selectedDuration / 30)).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text variant="subheading" weight="700" color="#FFFFFF">Confirmar</Text>
            }
          </TouchableOpacity>
        </View>
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

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     10,
    gap:               10,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: Colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    flex: 1,
    gap:  2,
  },
  courtNameText: {
    color: Colors.text,
  },
  availPill: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      999,
    backgroundColor:   Colors.successSurface,
    flexShrink:        0,
  },
  availText: {
    color: Colors.success,
  },

  // ── Court strip (pastillas compactas) ─────────────────────
  courtStrip: {
    paddingHorizontal: 16,
    paddingBottom:     8,
    gap:               6,
  },
  courtPill: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  courtPillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  courtPillText: {
    color: Colors.text,
  },
  courtPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Selector de duración ──────────────────────────────────
  durationRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingBottom:     10,
    gap:               10,
  },
  durationLabel: {
    flexShrink: 0,
  },
  durationGroup: {
    flexDirection: "row",
    gap:           6,
  },
  durationPill: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  durationPillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  durationText: {
    color: Colors.textMuted,
  },
  durationTextActive: {
    color: "#FFFFFF",
  },

  // ── Date strip (width fijo → sin layout shift) ────────────
  dateStrip: {
    paddingHorizontal: 16,
    paddingBottom:     10,
    gap:               6,
  },
  datePill: {
    width:           60,   // fijo → nunca cambia al activar/desactivar
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 8,
    borderRadius:    12,
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    gap:             1,
  },
  datePillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  datePillTop: {
    color:    Colors.textMuted,
    fontSize: 10,
  },
  datePillBottom: {
    color: Colors.text,
  },
  dateTextActive: {
    color: "#FFFFFF",
  },

  // ── Slot grid ─────────────────────────────────────────────
  slotFlatList: {
    flex: 1,  // evita el squish cuando aparece el checkout bar
  },
  slotList: {
    paddingHorizontal: 16,
    paddingTop:        4,
    paddingBottom:     24,
  },
  slotRow: {
    gap:          8,
    marginBottom: 8,
  },
  slotCard: {
    flex:            1,
    backgroundColor: Colors.cardBackground,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         12,
    gap:             3,
    position:        "relative",
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
  slotCardDisabled: {
    backgroundColor: Colors.surface,
    borderColor:     Colors.border,
    opacity:         0.4,
  },
  slotCardSelected: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  slotCheck: {
    position:        "absolute",
    top:             8,
    right:           8,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  slotTime: {
    color: Colors.text,
  },
  slotEnd: {
    color:    Colors.textMuted,
    fontSize: 11,
  },
  slotPrice: {
    color:     Colors.primary,
    marginTop: 4,
  },
  occupiedLabel: {
    color:     Colors.placeholder,
    marginTop: 4,
    fontSize:  10,
  },
  slotTextDisabled: {
    color: Colors.placeholder,
  },
  slotTextSelected: {
    color: "#FFFFFF",
  },

  // ── Checkout bar (position: absolute) ────────────────────
  checkoutBar: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   Colors.cardBackground,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    paddingTop:        14,
    paddingHorizontal: 16,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    ...Platform.select({
      ios: {
        shadowColor:   Colors.shadow,
        shadowOffset:  { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius:  12,
      },
      android: { elevation: 8 },
    }),
  },
  checkoutInfo: {
    flex: 1,
    gap:  3,
  },
  checkoutDateLabel: {
    textTransform: "capitalize",
  },
  checkoutPrice: {
    alignItems: "flex-end",
    gap:        2,
    flexShrink: 0,
  },
  confirmBtn: {
    backgroundColor:   Colors.primary,
    borderRadius:      12,
    paddingHorizontal: 18,
    paddingVertical:   12,
    alignItems:        "center",
    justifyContent:    "center",
    minWidth:          100,
    flexShrink:        0,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },

  // ── Estados ───────────────────────────────────────────────
  centered: {
    flex:              1,
    justifyContent:    "center",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 32,
    paddingVertical:   40,
  },
  centeredText: {
    textAlign: "center",
  },
  emptySlots: {
    alignItems:        "center",
    gap:               12,
    paddingVertical:   40,
    paddingHorizontal: 32,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   Colors.primarySubtle,
  },
});
