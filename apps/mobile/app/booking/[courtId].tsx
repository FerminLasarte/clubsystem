/**
 * Motor de Reservas — Pantalla Unificada por Deporte
 * ====================================================
 * Layout:
 *   1. Page Header: "Turnos Disponibles" + back + share
 *   2. Court info Card: nombre bold + subtítulo muted + badge libres (gris)
 *   3. Court selector: pills horizontales compactas (azul activo)
 *   4. Selector de duración: pills horizontales compactas
 *   5. Tira de fechas: pills compactas, sin espacios en blanco extra
 *   6. Grilla 30 min: 2 columnas, disponible/seleccionado/ocupado
 *   7. SummaryBar flotante al seleccionar un slot
 *
 * Colores: PRIMARY azul marino #0F172A para todos los estados activos.
 * NO SE USA Colors.accent (verde) en ningún elemento.
 *
 * Lógica de negocio: 100% intacta.
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
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors }       from "@/constants/Colors";
import { Text }         from "@/components/ui/Text";
import { Card }         from "@/components/Card";
import { useAuth }      from "@/context/AuthContext";
import { apiClient }    from "@/utils/api";

import { DatePill }     from "@/components/booking/DatePill";
import { DurationPill } from "@/components/booking/DurationPill";
import { SlotCard }     from "@/components/booking/SlotCard";
import { SummaryBar }   from "@/components/booking/SummaryBar";

// ── Tipos ─────────────────────────────────────────────────────

interface CourtItem {
  id:        string;
  name:      string;
  sport:     string;
  surface:   string | null;
  is_indoor: boolean;
  price:     number;
  _clubId:   string;
}

interface TimeSlot {
  start_time:   string;
  end_time:     string;
  is_available: boolean;
  price:        number;
}

interface CourtAvailability {
  court_id:   string;
  court_name: string;
  sport:      string;
  date:       string;
  is_member:  boolean;
  slots:      TimeSlot[];
}

interface ProcessedSlot extends TimeSlot {
  canSelect:      boolean;
  displayEndTime: string;
  totalPrice:     number;
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

function datePillLabels(
  d: Date,
  idx: number
): { dayLabel: string; dayNumber: string; accessLabel: string } {
  const day   = d.getDate();
  const month = MONTHS_ES[d.getMonth()];
  if (idx === 0) return { dayLabel: "HOY",    dayNumber: String(day), accessLabel: `Hoy, ${day} de ${month}` };
  if (idx === 1) return { dayLabel: "MÑN",    dayNumber: String(day), accessLabel: `Mañana, ${day} de ${month}` };
  const weekDay = DAYS_ES[d.getDay()];
  return { dayLabel: weekDay.toUpperCase(), dayNumber: String(day), accessLabel: `${weekDay} ${day} de ${month}` };
}

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

  const { courtId: sportKey } = useLocalSearchParams<{ courtId: string }>();
  const sport      = sportKey ?? "other";
  const sportLabel = SPORT_LABELS[sport] ?? sport;

  // ── Estado: canchas ───────────────────────────────────────
  const [courts,          setCourts]          = useState<CourtItem[]>([]);
  const [courtsLoading,   setCourtsLoading]   = useState(true);
  const [courtsError,     setCourtsError]     = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  // ── Estado: disponibilidad ────────────────────────────────
  const dates   = useRef(buildDateList(14)).current;
  const [dateIdx,       setDateIdx]       = useState(0);
  const [availability,  setAvailability]  = useState<CourtAvailability | null>(null);
  const [slotsLoading,  setSlotsLoading]  = useState(false);
  const [slotsError,    setSlotsError]    = useState<string | null>(null);
  const [selectedSlot,  setSelectedSlot]  = useState<TimeSlot | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // ── Duración ──────────────────────────────────────────────
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);

  const selectedDate = dates[dateIdx];
  const activeCourt  = courts.find((c) => c.id === selectedCourtId) ?? null;

  // ── is_member desde AuthContext ───────────────────────────
  const isMember = useMemo(() => {
    if (!activeCourt || !user) return false;
    const cid = activeCourt._clubId;
    return (
      (user.memberships ?? []).some((m) => m.clubId === cid && m.status === "APPROVED")
      || user.clubId === cid
    );
  }, [activeCourt, user]);

  // ── Slots procesados ──────────────────────────────────────
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

  useEffect(() => { setSelectedSlot(null); }, [selectedDuration]);

  // ── Cargar canchas ────────────────────────────────────────
  const loadCourts = useCallback(async () => {
    if (!user) return;
    setCourtsLoading(true);
    setCourtsError(null);
    const clubIds = [
      ...(user.memberships ?? []).filter((m) => m.status === "APPROVED").map((m) => m.clubId),
      ...(user.clubId ? [user.clubId] : []),
    ].filter((id, i, arr) => arr.indexOf(id) === i);

    if (clubIds.length === 0) { setCourts([]); setCourtsLoading(false); return; }

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

  // ── Fetch disponibilidad ──────────────────────────────────
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
    const endTime      = addMins(selectedSlot.start_time, selectedDuration);
    const blocksNeeded = selectedDuration / 30;
    const total        = selectedSlot.price * blocksNeeded;
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
      Alert.alert("No se pudo reservar", err instanceof Error ? err.message : "Intentá de nuevo más tarde.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Labels para SummaryBar ────────────────────────────────
  const summaryDateLabel = `${DAYS_ES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS_ES[selectedDate.getMonth()]}`;
  const summaryPriceLabel = selectedSlot
    ? `$${(selectedSlot.price * (selectedDuration / 30)).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : "";

  // ── Render ─────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* ── Page Header: "Turnos Disponibles" ── */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Feather name="chevron-left" size={20} color={Colors.primary} />
        </TouchableOpacity>

        <Text variant="heading" weight="700" style={styles.pageTitle} numberOfLines={1}>
          Turnos Disponibles
        </Text>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Compartir"
        >
          <Feather name="share" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Court info Card ── */}
      {!courtsLoading && !courtsError && activeCourt && (
        <View style={styles.courtHeaderWrapper}>
          <Card style={styles.courtHeaderCard} padding={0}>
            <View style={styles.courtHeaderInner}>
              <View style={styles.courtHeaderText}>
                <Text variant="subheading" weight="700" numberOfLines={1} style={styles.courtName}>
                  {activeCourt.name}
                </Text>
                <Text variant="label" muted numberOfLines={1}>
                  {sportLabel}{isMember ? " · Socio" : " · Visitante"}
                </Text>
              </View>
              {!slotsLoading && availableCount > 0 && (
                <View style={styles.availBadge}>
                  <Text variant="label" style={styles.availBadgeText}>
                    {availableCount} libre{availableCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

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
            <Text variant="caption" weight="600" color={Colors.primary}>Reintentar</Text>
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
          {/* ── Selector de cancha: pills compactas horizontales ── */}
          {courts.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={styles.pillStrip}
            >
              {courts.map((court) => {
                const isActive = court.id === selectedCourtId;
                return (
                  <TouchableOpacity
                    key={court.id}
                    style={[styles.courtPill, isActive && styles.courtPillActive]}
                    onPress={() => { setSelectedCourtId(court.id); setSelectedSlot(null); }}
                    activeOpacity={0.75}
                  >
                    <Text
                      variant="caption"
                      weight="600"
                      style={[styles.courtPillText, isActive && styles.pillTextActive]}
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
          <View style={styles.sectionRow}>
            <Text variant="label" style={styles.sectionTag}>DURACIÓN</Text>
            <View style={styles.pillGroup}>
              {DURATION_OPTIONS.map((d) => (
                <DurationPill
                  key={d}
                  minutes={d}
                  isActive={d === selectedDuration}
                  onPress={() => setSelectedDuration(d)}
                />
              ))}
            </View>
          </View>

          {/* ── Tira de fechas ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.dateStrip}
          >
            {dates.map((d, idx) => {
              const labels = datePillLabels(d, idx);
              return (
                <DatePill
                  key={idx}
                  dayLabel={labels.dayLabel}
                  dayNumber={labels.dayNumber}
                  isActive={idx === dateIdx}
                  onPress={() => setDateIdx(idx)}
                  accessLabel={labels.accessLabel}
                />
              );
            })}
          </ScrollView>

          {/* ── Separador ── */}
          <View style={styles.divider} />

          {/* ── Grilla de horarios ── */}
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
                <Text variant="caption" weight="600" color={Colors.primary}>Reintentar</Text>
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
                hasCheckout && { paddingBottom: insets.bottom + 190 },
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
                return (
                  <SlotCard
                    startTime={item.start_time}
                    endTime={item.displayEndTime}
                    totalPrice={item.totalPrice}
                    isAvailable={item.is_available}
                    canSelect={item.canSelect}
                    isSelected={isSelected}
                    onPress={() => setSelectedSlot(isSelected ? null : item)}
                  />
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Summary bar flotante ── */}
      {hasCheckout && selectedSlot && activeCourt && (
        <SummaryBar
          dateLabel={summaryDateLabel}
          startTime={selectedSlot.start_time}
          endTime={addMins(selectedSlot.start_time, selectedDuration)}
          duration={selectedDuration}
          priceLabel={summaryPriceLabel}
          isMember={isMember}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
          bottomInset={insets.bottom}
        />
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

  // ── Page header ───────────────────────────────────────────
  pageHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     10,
    gap:               4,
  },
  iconBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: Colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  pageTitle: {
    flex:          1,
    textAlign:     "center",
    color:         Colors.primary,
    letterSpacing: -0.3,
    fontSize:      17,
  },

  // ── Court info card ───────────────────────────────────────
  courtHeaderWrapper: {
    paddingHorizontal: 16,
    marginBottom:      10,
  },
  courtHeaderCard: {
    borderRadius:      14,
    paddingVertical:   12,
    paddingHorizontal: 14,
  },
  courtHeaderInner: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  courtHeaderText: {
    flex: 1,
    gap:  3,
  },
  courtName: {
    color:         Colors.primary,
    letterSpacing: -0.3,
    fontSize:      16,
  },
  availBadge: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
    flexShrink:        0,
    marginLeft:        10,
  },
  availBadgeText: {
    color:         Colors.text,
    letterSpacing: 0.1,
    fontSize:      11,
  },

  // ── Pill strips ───────────────────────────────────────────
  pillStrip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom:     8,
    gap:               8,
  },
  courtPill: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courtPillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  courtPillText: {
    color:     Colors.textMuted,
    fontSize:  13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },

  // ── Duración ──────────────────────────────────────────────
  sectionRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingBottom:     8,
    gap:               12,
  },
  sectionTag: {
    flexShrink:    0,
    fontSize:      10,
    letterSpacing: 0.4,
    color:         Colors.placeholder,
    fontWeight:    "600",
  },
  pillGroup: {
    flexDirection: "row",
    gap:           6,
  },

  // ── Date strip ────────────────────────────────────────────
  dateStrip: {
    paddingHorizontal: 16,
    paddingBottom:     8,   // ajustado: sin espacio extra inferioir
    gap:               6,
  },

  // ── Divisor ───────────────────────────────────────────────
  divider: {
    height:           1,
    marginHorizontal: 16,
    backgroundColor:  Colors.border,
    marginBottom:     10,
  },

  // ── Slot grid ─────────────────────────────────────────────
  slotFlatList: {
    flex: 1,
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

  // ── Estados ───────────────────────────────────────────────
  centered: {
    flex:              1,
    justifyContent:    "center",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 32,
    paddingVertical:   32,
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
