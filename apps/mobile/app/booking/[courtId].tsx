/**
 * Motor de Reservas — Pantalla Unificada por Deporte
 * ============================================================================
 * Flujo jerárquico paso a paso:
 *   1. Selector de Día      (DatePills — tira horizontal)
 *   2. Selector de Horario  (TimePills — grilla de chips envolvente)
 *   3. Selector de Duración (DurationPills — 60 / 90 / 120 min)
 *   4. Canchas disponibles  (CourtCards — lista vertical)
 *
 * Cada nivel reacciona al anterior:
 *   · Cambiar Día     → limpia Horario y Cancha seleccionada.
 *   · Cambiar Horario → limpia Cancha seleccionada.
 *   · Cambiar Duración → limpia Cancha seleccionada y re-filtra canchas.
 *
 * Los horarios disponibles se calculan independientemente de la duración
 * (cualquier cancha con al menos un bloque de 30 min libre), mientras que
 * las CourtCards solo muestran canchas que pueden acomodar la duración elegida.
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
import { TimePill }     from "@/components/booking/TimePill";
import { DurationPill } from "@/components/booking/DurationPill";
import { CourtCard }    from "@/components/booking/CourtCard";
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
 * Slot procesado: datos de origen de la cancha + cálculos de duración.
 * Incluye surface e is_indoor para que CourtCard no necesite lookups extra.
 */
interface MergedSlot extends TimeSlot {
  courtId:        string;
  courtName:      string;
  courtClubId:    string;
  courtSurface:   string | null;
  courtIsIndoor:  boolean;
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

  // ── Estado: canchas del club ──────────────────────────────
  const [courts,        setCourts]        = useState<CourtItem[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError,   setCourtsError]   = useState<string | null>(null);

  // ── Estado: disponibilidad cruda de todas las canchas ─────
  const dates = useRef(buildDateList(14)).current;
  const [dateIdx,           setDateIdx]           = useState(0);
  const [allAvailabilities, setAllAvailabilities] = useState<CourtAvailability[]>([]);
  const [slotsLoading,      setSlotsLoading]      = useState(false);
  const [slotsError,        setSlotsError]        = useState<string | null>(null);

  // ── Estado: selecciones jerárquicas ──────────────────────
  const [selectedTime,     setSelectedTime]     = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);
  const [selectedSlot,     setSelectedSlot]     = useState<MergedSlot | null>(null);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  const selectedDate = dates[dateIdx];

  // ── Cascada de reset al cambiar selecciones ───────────────
  useEffect(() => {
    setSelectedTime(null);
    setSelectedSlot(null);
  }, [dateIdx]);

  useEffect(() => { setSelectedSlot(null); }, [selectedTime]);
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

  const isGenerallyMember = useMemo(() => {
    if (!user) return false;
    return (
      (user.memberships ?? []).some((m) => m.status === "APPROVED") ||
      user.clubId !== null
    );
  }, [user]);

  const isMember = useMemo(() => {
    if (!selectedSlot || !user) return false;
    const cid = selectedSlot.courtClubId;
    return (
      (user.memberships ?? []).some((m) => m.clubId === cid && m.status === "APPROVED") ||
      user.clubId === cid
    );
  }, [selectedSlot, user]);

  // ── processedSlots: slots viables para la duración elegida ─
  // Incluye courtSurface y courtIsIndoor para las CourtCards.
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
          courtSurface:   court.surface,
          courtIsIndoor:  court.is_indoor,
          canSelect,
          displayEndTime: addMins(slot.start_time, selectedDuration),
          totalPrice:     slot.price * blocksNeeded,
        });
      }
    }

    merged.sort((a, b) => {
      if (a.start_time < b.start_time) return -1;
      if (a.start_time > b.start_time) return  1;
      return a.courtName.localeCompare(b.courtName, "es");
    });

    const isTodaySelected = dateIdx === 0;
    const now     = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return merged.filter((s) => {
      if (isTodaySelected) {
        const [h, m] = s.start_time.split(":").map(Number);
        if (h * 60 + m <= nowMins) return false;
      }
      return s.canSelect;
    });
  }, [allAvailabilities, selectedDuration, courts, dateIdx]);

  // ── availableStartTimes: horarios con al menos 1 bloque libre ─
  // Calculado sin considerar duración, para poblar los TimePills.
  const availableStartTimes = useMemo((): string[] => {
    const timesSet        = new Set<string>();
    const isTodaySelected = dateIdx === 0;
    const now             = new Date();
    const nowMins         = now.getHours() * 60 + now.getMinutes();

    for (const avail of allAvailabilities) {
      for (const slot of avail.slots) {
        if (!slot.is_available) continue;
        if (isTodaySelected) {
          const [h, m] = slot.start_time.split(":").map(Number);
          if (h * 60 + m <= nowMins) continue;
        }
        timesSet.add(slot.start_time);
      }
    }
    return Array.from(timesSet).sort();
  }, [allAvailabilities, dateIdx]);

  // ── courtsForSelection: canchas viables para [hora + duración] ─
  const courtsForSelection = useMemo((): MergedSlot[] => {
    if (!selectedTime) return [];
    return processedSlots.filter((s) => s.start_time === selectedTime);
  }, [processedSlots, selectedTime]);

  const hasCheckout = selectedSlot !== null;

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
      setCourts(results.flat().filter((c) => c.sport === sport));
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
  const summaryDateLabel  = `${DAYS_ES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS_ES[selectedDate.getMonth()]}`;
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

      {/* ── Identity Card ── */}
      {!courtsLoading && !courtsError && (
        <View style={styles.identityWrapper}>
          <Card padding={0} style={styles.identityCard}>
            <View style={styles.identityInner}>
              <View style={styles.clubAvatar}>
                <Text variant="subheading" weight="800" style={styles.clubAvatarText}>
                  {displayClub.initials}
                </Text>
              </View>

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
                  <View style={styles.sportBadge}>
                    <Text variant="label" style={styles.sportBadgeText}>
                      {sportLabel}
                    </Text>
                  </View>
                  <View style={[styles.memberBadge, isGenerallyMember && styles.memberBadgeActive]}>
                    <Text
                      variant="label"
                      style={[styles.memberBadgeText, isGenerallyMember && styles.memberBadgeTextActive]}
                    >
                      {isGenerallyMember ? "Socio" : "Visitante"}
                    </Text>
                  </View>
                </View>
              </View>

              {!slotsLoading && availableStartTimes.length > 0 && (
                <View style={styles.availBadge}>
                  <Text variant="heading" weight="700" style={styles.availCount}>
                    {availableStartTimes.length}
                  </Text>
                  <Text variant="caption" muted style={styles.availLabel}>
                    horarios
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

      {/* ── Carga inicial de canchas ── */}
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
        // ── Contenido scrolleable ──
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            hasCheckout && { paddingBottom: insets.bottom + 190 },
          ]}
        >

          {/* ── Paso 1: Selector de día ── */}
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

          <View style={styles.divider} />

          {/* ── Paso 2: Selector de horario ── */}
          <View style={styles.sectionHeader}>
            <Text variant="label" weight="700" style={styles.sectionLabel}>
              HORARIO DE INICIO
            </Text>
          </View>

          {slotsLoading ? (
            <View style={styles.sectionLoader}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : slotsError ? (
            <View style={styles.sectionEmpty}>
              <Feather name="alert-circle" size={22} color={Colors.danger} />
              <Text variant="caption" muted style={styles.centeredText}>
                {slotsError}
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchAvailability(dateIdx)}
                activeOpacity={0.8}
              >
                <Text variant="caption" weight="600" color={Colors.primary}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          ) : availableStartTimes.length === 0 ? (
            <View style={styles.sectionEmpty}>
              <Feather name="clock" size={22} color={Colors.surfaceRaised} />
              <Text variant="caption" muted style={styles.centeredText}>
                No hay horarios disponibles para este día
              </Text>
            </View>
          ) : (
            <View style={styles.timeChipsWrap}>
              {availableStartTimes.map((time) => (
                <TimePill
                  key={time}
                  time={time}
                  isActive={selectedTime === time}
                  onPress={() => setSelectedTime(selectedTime === time ? null : time)}
                />
              ))}
            </View>
          )}

          {/* ── Paso 3: Selector de duración (visible al elegir horario) ── */}
          {selectedTime !== null && (
            <>
              <View style={styles.divider} />
              <View style={styles.sectionHeader}>
                <Text variant="label" weight="700" style={styles.sectionLabel}>
                  DURACIÓN DEL TURNO
                </Text>
              </View>
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
            </>
          )}

          {/* ── Paso 4: Canchas disponibles (visible al elegir horario + duración) ── */}
          {selectedTime !== null && (
            <>
              <View style={styles.divider} />
              <View style={styles.sectionHeader}>
                <Text variant="label" weight="700" style={styles.sectionLabel}>
                  CANCHAS DISPONIBLES
                </Text>
                {courtsForSelection.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text variant="label" weight="700" style={styles.countBadgeText}>
                      {courtsForSelection.length}
                    </Text>
                  </View>
                )}
              </View>

              {courtsForSelection.length === 0 ? (
                <View style={styles.sectionEmpty}>
                  <Feather name="slash" size={22} color={Colors.surfaceRaised} />
                  <Text variant="caption" muted style={styles.centeredText}>
                    No hay canchas disponibles para {selectedTime} · {selectedDuration} min
                  </Text>
                </View>
              ) : (
                <View style={styles.courtsList}>
                  {courtsForSelection.map((slot) => {
                    const isSelected =
                      selectedSlot?.courtId === slot.courtId &&
                      selectedSlot?.start_time === slot.start_time;
                    return (
                      <CourtCard
                        key={`${slot.courtId}-${slot.start_time}`}
                        courtName={slot.courtName}
                        surface={slot.courtSurface}
                        isIndoor={slot.courtIsIndoor}
                        startTime={slot.start_time}
                        endTime={slot.displayEndTime}
                        totalPrice={slot.totalPrice}
                        isSelected={isSelected}
                        onPress={() => setSelectedSlot(isSelected ? null : slot)}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}

        </ScrollView>
      )}

      {/* ── SummaryBar flotante al seleccionar una cancha ── */}
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
    color:    Colors.textMuted,
    fontSize: 11,
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
    color:    Colors.textMuted,
    fontSize: 11,
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

  // ── Scroll container ──────────────────────────────────────
  scrollContent: {
    paddingBottom: 32,
  },

  // ── Date strip ────────────────────────────────────────────
  dateStrip: {
    paddingHorizontal: 16,
    paddingBottom:     10,
    gap:               6,
  },

  // ── Divisor ───────────────────────────────────────────────
  divider: {
    height:           1,
    marginHorizontal: 16,
    backgroundColor:  Colors.border,
    marginBottom:     16,
  },

  // ── Section headers ───────────────────────────────────────
  sectionHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    marginBottom:      12,
    gap:               8,
  },
  sectionLabel: {
    color:         Colors.placeholder,
    fontSize:      11,
    letterSpacing: 0.8,
  },
  countBadge: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: Colors.primarySubtle,
    alignItems:      "center",
    justifyContent:  "center",
  },
  countBadgeText: {
    color:    Colors.primary,
    fontSize: 11,
  },

  // ── Time chips ────────────────────────────────────────────
  timeChipsWrap: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: 16,
    gap:               8,
    marginBottom:      4,
  },

  // ── Duration strip ────────────────────────────────────────
  durationStrip: {
    flexDirection:     "row",
    paddingHorizontal: 16,
    gap:               8,
    marginBottom:      4,
  },

  // ── Courts list ───────────────────────────────────────────
  courtsList: {
    paddingHorizontal: 16,
    gap:               10,
  },

  // ── Section states ────────────────────────────────────────
  sectionLoader: {
    alignItems:    "center",
    paddingVertical: 24,
  },
  sectionEmpty: {
    alignItems:        "center",
    gap:               10,
    paddingVertical:   28,
    paddingHorizontal: 32,
  },

  // ── Estados globales ──────────────────────────────────────
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
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   Colors.primarySubtle,
  },
});
