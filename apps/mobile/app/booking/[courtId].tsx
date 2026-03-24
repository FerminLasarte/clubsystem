/**
 * Motor de Reservas — Pantalla Unificada por Deporte (Rediseño UX Definitivo)
 * ============================================================================
 * Layout:
 *   1. Page Header compacto: back + "Turnos Disponibles" + share
 *   2. Identity Card: avatar iniciales, nombre del club, badge deporte + membresía
 *   3. Tira de fechas (DatePills) — scroll horizontal
 *   4. Selector de duración (DurationPills) — 60 / 90 / 120
 *   5. Grilla 2 columnas de SlotCards — todos los slots de todas las canchas
 *      agrupados y ordenados cronológicamente, cada card muestra a qué cancha pertenece
 *   6. SummaryBar flotante al seleccionar un slot
 *
 * Colores: PRIMARY azul marino #0F172A para todos los estados activos.
 * NO se usa Colors.accent (verde) en ningún elemento.
 *
 * Lógica: fetchAvailability obtiene disponibilidad de TODAS las canchas del
 * deporte/club en paralelo, concatena y ordena cronológicamente.
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

/**
 * Slot mezclado: incluye datos de la cancha de origen + cálculos de duración.
 * El array final ordena todos los slots de todas las canchas cronológicamente.
 */
interface MergedSlot extends TimeSlot {
  courtId:        string;
  courtName:      string;
  courtClubId:    string;
  canSelect:      boolean;   // hay N bloques consecutivos libres en esa cancha
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
  if (idx === 0) return { dayLabel: "HOY",  dayNumber: String(day), accessLabel: `Hoy, ${day} de ${month}` };
  if (idx === 1) return { dayLabel: "MÑN",  dayNumber: String(day), accessLabel: `Mañana, ${day} de ${month}` };
  const weekDay = DAYS_ES[d.getDay()];
  return { dayLabel: weekDay.toUpperCase(), dayNumber: String(day), accessLabel: `${weekDay} ${day} de ${month}` };
}

function addMins(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Extrae hasta 2 iniciales mayúsculas de un nombre de club */
function buildInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
  const [courts,        setCourts]        = useState<CourtItem[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError,   setCourtsError]   = useState<string | null>(null);

  // ── Estado: disponibilidad (todas las canchas) ────────────
  const dates = useRef(buildDateList(14)).current;
  const [dateIdx,          setDateIdx]          = useState(0);
  const [allAvailabilities, setAllAvailabilities] = useState<CourtAvailability[]>([]);
  const [slotsLoading,     setSlotsLoading]     = useState(false);
  const [slotsError,       setSlotsError]       = useState<string | null>(null);
  const [selectedSlot,     setSelectedSlot]     = useState<MergedSlot | null>(null);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  // ── Duración ──────────────────────────────────────────────
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);

  const selectedDate = dates[dateIdx];

  // ── Limpiar slot al cambiar duración ─────────────────────
  useEffect(() => { setSelectedSlot(null); }, [selectedDuration]);

  // ── Info del club para la Identity Card ───────────────────
  const displayClub = useMemo(() => {
    if (!user || courts.length === 0) return { name: "Mi Club", initials: "MC" };
    const clubIds = [...new Set(courts.map((c) => c._clubId))];
    if (clubIds.length === 1) {
      const membership = (user.memberships ?? []).find((m) => m.clubId === clubIds[0]);
      const name = membership?.clubName ?? user.clubName ?? "Mi Club";
      return { name, initials: buildInitials(name) };
    }
    return { name: "Mis Clubs", initials: "MC" };
  }, [courts, user]);

  /** ¿Tiene al menos una membresía aprobada? (para badge Socio/Visitante) */
  const isGenerallyMember = useMemo(() => {
    if (!user) return false;
    return (
      (user.memberships ?? []).some((m) => m.status === "APPROVED") ||
      user.clubId !== null
    );
  }, [user]);

  /** isMember para el SummaryBar — basado en el club de la cancha seleccionada */
  const isMember = useMemo(() => {
    if (!selectedSlot || !user) return false;
    const cid = selectedSlot.courtClubId;
    return (
      (user.memberships ?? []).some((m) => m.clubId === cid && m.status === "APPROVED") ||
      user.clubId === cid
    );
  }, [selectedSlot, user]);

  // ── Slots mezclados + ordenados cronológicamente ──────────
  const processedSlots = useMemo((): MergedSlot[] => {
    const blocksNeeded = selectedDuration / 30;
    const merged: MergedSlot[] = [];

    for (const avail of allAvailabilities) {
      const court = courts.find((c) => c.id === avail.court_id);
      if (!court) continue;

      const slots = avail.slots;
      for (let idx = 0; idx < slots.length; idx++) {
        const slot = slots[idx];
        let canSelect = true;
        for (let k = 0; k < blocksNeeded; k++) {
          const s = slots[idx + k];
          if (!s || !s.is_available) { canSelect = false; break; }
        }
        merged.push({
          ...slot,
          courtId:        court.id,
          courtName:      avail.court_name,
          courtClubId:    court._clubId,
          canSelect,
          displayEndTime: addMins(slot.start_time, selectedDuration),
          totalPrice:     slot.price * blocksNeeded,
        });
      }
    }

    // Ordenar cronológicamente; empate → por nombre de cancha
    merged.sort((a, b) => {
      if (a.start_time < b.start_time) return -1;
      if (a.start_time > b.start_time) return  1;
      return a.courtName.localeCompare(b.courtName, "es");
    });

    // ── Filtro estricto de viabilidad ────────────────────────────────────
    // Regla 1 — No pasados: para HOY descarta slots cuyo inicio ≤ ahora.
    const isTodaySelected = dateIdx === 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return merged.filter((s) => {
      if (isTodaySelected) {
        const [h, m] = s.start_time.split(":").map(Number);
        if (h * 60 + m <= nowMins) return false;
      }
      // Regla 2 (ocupados) + Regla 3 (desbordamiento horario de cierre):
      // canSelect ya cubre ambos casos — false si algún bloque está
      // ocupado o no existe en la lista generada por el backend.
      return s.canSelect;
    });
  }, [allAvailabilities, selectedDuration, courts, dateIdx]);

  const hasCheckout    = selectedSlot !== null;
  const availableCount = processedSlots.filter((s) => s.canSelect).length;

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
    } catch (err) {
      setCourtsError(err instanceof Error ? err.message : "Error al cargar canchas");
    } finally {
      setCourtsLoading(false);
    }
  }, [user, sport]);

  useEffect(() => { loadCourts(); }, [loadCourts]);

  // ── Fetch disponibilidad de TODAS las canchas ─────────────
  const fetchAvailability = useCallback(
    async (idx: number) => {
      if (courts.length === 0) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);
      const dateStr = formatDateParam(dates[idx]);
      try {
        const results = await Promise.all(
          courts.map((court) =>
            apiClient.get<CourtAvailability>(
              `/mobile/courts/${court.id}/availability?date=${dateStr}&duration=30`
            )
          )
        );
        setAllAvailabilities(results);
      } catch (err) {
        setSlotsError(err instanceof Error ? err.message : "Error al cargar disponibilidad");
      } finally {
        setSlotsLoading(false);
      }
    },
    [dates, courts]
  );

  useEffect(() => {
    if (courts.length > 0) fetchAvailability(dateIdx);
  }, [courts, dateIdx, fetchAvailability]);

  // ── Confirmar reserva ─────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    try {
      await apiClient.post("/mobile/reservations", {
        court_id:   selectedSlot.courtId,
        date:       formatDateParam(selectedDate),
        start_time: selectedSlot.start_time,
        duration:   selectedDuration,
      });
      Alert.alert(
        "¡Reserva solicitada!",
        `${selectedSlot.courtName}\n${selectedSlot.start_time} – ${selectedSlot.displayEndTime}\n$${selectedSlot.totalPrice.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
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
    ? `$${selectedSlot.totalPrice.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : "";

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.appBackground} />

      {/* ── Page Header ── */}
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

      {/* ── Identity Card (Top Card Premium) ── */}
      {!courtsLoading && !courtsError && (
        <View style={styles.identityWrapper}>
          <Card padding={0} style={styles.identityCard}>
            <View style={styles.identityInner}>

              {/* Avatar con iniciales del club */}
              <View style={styles.clubAvatar}>
                <Text variant="subheading" weight="800" style={styles.clubAvatarText}>
                  {displayClub.initials}
                </Text>
              </View>

              {/* Nombre + badges */}
              <View style={styles.clubMeta}>
                <Text
                  variant="subheading"
                  weight="700"
                  numberOfLines={1}
                  style={styles.clubName}
                >
                  {displayClub.name}
                </Text>
                <View style={styles.badgeRow}>
                  {/* Deporte */}
                  <View style={styles.sportBadge}>
                    <Text variant="label" style={styles.sportBadgeText}>
                      {sportLabel}
                    </Text>
                  </View>
                  {/* Membresía */}
                  <View
                    style={[
                      styles.memberBadge,
                      isGenerallyMember && styles.memberBadgeActive,
                    ]}
                  >
                    <Text
                      variant="label"
                      style={[
                        styles.memberBadgeText,
                        isGenerallyMember && styles.memberBadgeTextActive,
                      ]}
                    >
                      {isGenerallyMember ? "Socio" : "Visitante"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Badge de slots libres */}
              {!slotsLoading && availableCount > 0 && (
                <View style={styles.availBadge}>
                  <Text variant="heading" weight="700" style={styles.availCount}>
                    {availableCount}
                  </Text>
                  <Text variant="caption" muted style={styles.availLabel}>
                    libres
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
          {/* ── 1. Tira de fechas ── */}
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

          {/* ── 2. Selector de duración ── */}
          <View style={styles.durationStrip}>
            {DURATION_OPTIONS.map((d) => (
              <DurationPill
                key={d}
                minutes={d}
                isActive={d === selectedDuration}
                onPress={() => setSelectedDuration(d)}
              />
            ))}
          </View>

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
                onPress={() => fetchAvailability(dateIdx)}
                activeOpacity={0.8}
              >
                <Text variant="caption" weight="600" color={Colors.primary}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={processedSlots}
              keyExtractor={(item) => `${item.courtId}-${item.start_time}`}
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
                const isSelected =
                  selectedSlot?.courtId === item.courtId &&
                  selectedSlot?.start_time === item.start_time;
                return (
                  <SlotCard
                    startTime={item.start_time}
                    endTime={item.displayEndTime}
                    totalPrice={item.totalPrice}
                    isAvailable={item.is_available}
                    canSelect={item.canSelect}
                    isSelected={isSelected}
                    courtName={item.courtName}
                    onPress={() =>
                      setSelectedSlot(
                        isSelected ? null : item
                      )
                    }
                  />
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Summary bar flotante ── */}
      {hasCheckout && selectedSlot && (
        <SummaryBar
          dateLabel={summaryDateLabel}
          startTime={selectedSlot.start_time}
          endTime={selectedSlot.displayEndTime}
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
    paddingBottom:     12,
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

  // ── Identity Card ─────────────────────────────────────────
  identityWrapper: {
    paddingHorizontal: 16,
    marginBottom:      14,
  },
  identityCard: {
    borderRadius: 18,
  },
  identityInner: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingVertical:   18,
    gap:               16,
  },
  clubAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.primary,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  clubAvatarText: {
    color:         Colors.textOnBrand,
    fontSize:      18,
    letterSpacing: -0.5,
  },
  clubMeta: {
    flex: 1,
    gap:  6,
  },
  clubName: {
    color:         Colors.primary,
    letterSpacing: -0.3,
    fontSize:      16,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  sportBadgeText: {
    color:     Colors.textMuted,
    fontSize:  11,
  },
  memberBadge: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  memberBadgeActive: {
    backgroundColor: Colors.primarySubtle,
    borderColor:     Colors.primaryBorder,
  },
  memberBadgeText: {
    color:     Colors.textMuted,
    fontSize:  11,
  },
  memberBadgeTextActive: {
    color: Colors.primary,
  },
  availBadge: {
    alignItems:  "center",
    flexShrink:  0,
    paddingLeft: 8,
  },
  availCount: {
    color:         Colors.primary,
    fontSize:      22,
    letterSpacing: -0.5,
  },
  availLabel: {
    fontSize:      10,
    letterSpacing: 0.2,
  },

  // ── Date strip ────────────────────────────────────────────
  dateStrip: {
    paddingHorizontal: 16,
    paddingBottom:     10,
    gap:               6,
  },

  // ── Duration strip ────────────────────────────────────────
  durationStrip: {
    flexDirection:     "row",
    paddingHorizontal: 16,
    paddingBottom:     12,
    gap:               8,
  },

  // ── Divisor ───────────────────────────────────────────────
  divider: {
    height:           1,
    marginHorizontal: 16,
    backgroundColor:  Colors.border,
    marginBottom:     12,
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
    gap:          10,
    marginBottom: 10,
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
    paddingVertical:   48,
    paddingHorizontal: 32,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   Colors.primarySubtle,
  },
});
