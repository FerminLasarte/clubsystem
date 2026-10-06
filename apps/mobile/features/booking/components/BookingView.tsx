import type { AppDuration, Sport } from "@clubsystem/api";
import { SPORT_LABELS, todayIn } from "@clubsystem/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { approvedMemberships, useMyMemberships } from "@/features/clubs/hooks";
import { errorMessage, isApiError } from "@clubsystem/api";
import { useRefreshOnFocus } from "@/shared/hooks/useRefreshOnFocus";
import { deviceTimeZone } from "@/shared/lib/time";
import { ChipSelector, PullToRefresh, QueryState, Screen, screenContent, StateView } from "@/shared/ui";
import { spacing } from "@/shared/theme/tokens";

import { useAvailability, useClubCourts, useCreateReservation } from "../hooks";
import { bookingDays } from "../lib/dates";
import { DURATIONS, durationLabel, sportsOf } from "../lib/options";
import { BookingSummary } from "./BookingSummary";
import { CourtSlotsCard } from "./CourtSlotsCard";

interface Selection {
  /** Parámetros con los que se eligió: si cambian, la selección deja de valer. */
  key: string;
  courtId: string;
  startsAt: string;
}

/**
 * Club (de mis membresías aprobadas) → deporte → fecha (14 días, zona del club) → duración →
 * turnos libres por cancha con precio → confirmar. El backend calcula disponibilidad y precios.
 */
export function BookingView() {
  const memberships = useMyMemberships();
  const clubs = approvedMemberships(memberships.data).map((m) => m.club);

  const [clubId, setClubId] = useState<string>();
  const club = clubs.find((c) => c.id === clubId) ?? clubs[0];

  const courts = useClubCourts(club?.id);
  const sports = sportsOf(courts.data);
  const [sport, setSport] = useState<Sport>();
  const activeSport = sport && sports.includes(sport) ? sport : sports[0];

  const days = club ? bookingDays(todayIn(club.timezone)) : [];
  const [date, setDate] = useState<string>();
  const activeDate = days.find((d) => d.date === date)?.date ?? days[0]?.date;

  const [duration, setDuration] = useState<AppDuration>(60);

  const params =
    club && activeSport && activeDate ? { clubId: club.id, sport: activeSport, date: activeDate, duration } : null;
  const availability = useAvailability(params);
  const paramsKey = params ? JSON.stringify(params) : "";

  const [selection, setSelection] = useState<Selection | null>(null);
  const current = !availability.isPlaceholderData ? availability.data : undefined;
  const selectedCourt =
    selection?.key === paramsKey ? current?.courts.find((c) => c.court_id === selection.courtId) : undefined;
  const selectedSlot = selectedCourt?.slots.find((s) => s.starts_at === selection?.startsAt);

  const tz = club?.timezone ?? deviceTimeZone();

  const create = useCreateReservation();
  useRefreshOnFocus(availability.refetch);

  if (memberships.isPending || memberships.isError) {
    return (
      <Screen>
        <QueryState query={memberships} />
      </Screen>
    );
  }

  if (!club) {
    return (
      <Screen>
        <StateView
          kind="empty"
          title="Para reservar tenés que ser socio de un club"
          description="Pedí la membresía desde Explorar. Cuando el club la apruebe vas a poder reservar canchas."
          action={{ title: "Explorar clubes", onPress: () => router.navigate("/explore") }}
        />
      </Screen>
    );
  }

  const confirm = () => {
    if (!params || !selectedCourt || !selectedSlot) return;
    create.mutate(
      { clubId: params.clubId, courtId: selectedCourt.court_id, startsAt: selectedSlot.starts_at, duration },
      {
        onSuccess: (reservation) => {
          setSelection(null);
          router.push({ pathname: "/reservation/[id]", params: { id: reservation.id } });
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 409) {
            setSelection(null);
            Alert.alert(
              "Ese turno ya no está disponible",
              "Alguien lo reservó hace un momento. Actualizamos los horarios para que elijas otro.",
            );
          } else {
            Alert.alert("No se pudo reservar", errorMessage(error));
          }
        },
      },
    );
  };

  const header = (
    <View style={styles.selectors}>
      {clubs.length > 1 ? (
        <ChipSelector
          title="Club"
          options={clubs.map((c) => ({ value: c.id, label: c.name }))}
          value={club.id}
          onChange={setClubId}
        />
      ) : null}
      {courts.isPending || courts.isError ? (
        <QueryState query={courts} />
      ) : (
        <ChipSelector
          title="Deporte"
          options={sports.map((s) => ({ value: s, label: SPORT_LABELS[s] }))}
          value={activeSport}
          onChange={setSport}
        />
      )}
      {club ? (
        <ChipSelector
          title="Día"
          options={days.map((d) => ({ value: d.date, label: d.label, detail: d.detail }))}
          value={activeDate}
          onChange={setDate}
        />
      ) : null}
      <ChipSelector
        title="Duración"
        options={DURATIONS.map((d) => ({ value: d, label: durationLabel(d) }))}
        value={duration}
        onChange={setDuration}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={params ? (availability.data?.courts ?? []) : []}
        keyExtractor={(c) => c.court_id}
        contentContainerStyle={screenContent.padded}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <CourtSlotsCard
            court={item}
            timeZone={tz}
            selectedStart={item.court_id === selectedCourt?.court_id ? selectedSlot?.starts_at : undefined}
            onSelect={(startsAt) => setSelection({ key: paramsKey, courtId: item.court_id, startsAt })}
          />
        )}
        refreshControl={<PullToRefresh onRefresh={availability.refetch} />}
        ListEmptyComponent={
          !params ? (
            courts.data && sports.length === 0 ? (
              <StateView kind="empty" title="Este club todavía no tiene canchas habilitadas" />
            ) : null
          ) : availability.isPending || availability.isError ? (
            <QueryState query={availability} />
          ) : (
            <StateView kind="empty" title="No hay canchas para ese deporte" />
          )
        }
      />
      {selectedCourt && selectedSlot ? (
        <BookingSummary
          clubName={club.name}
          court={selectedCourt}
          slot={selectedSlot}
          durationMinutes={duration}
          timeZone={tz}
          submitting={create.isPending}
          onConfirm={confirm}
          onCancel={() => setSelection(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectors: {
    gap: spacing.lg,
  },
});
