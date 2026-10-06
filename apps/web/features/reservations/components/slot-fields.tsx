"use client";

import { FormField } from "@/components/shared/form-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourts } from "@/features/courts/api";
import { formatDuration, zonedToIso } from "@/features/reservations/time";

const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];

export interface SlotDefaults {
  courtId?: string;
  day: string;
  time?: string;
  duration?: number;
}

/** Cancha, día, hora de inicio y duración (hora local del club). El backend valida horario y solapamiento. */
export function SlotFields({ defaults }: { defaults: SlotDefaults }) {
  const courts = useCourts();
  const active = courts.data?.filter((court) => court.is_active) ?? [];
  const duration = defaults.duration ?? 60;
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  return (
    <>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="slot-court">Cancha</Label>
        <Select name="court_id" defaultValue={defaults.courtId} required disabled={courts.isPending}>
          <SelectTrigger id="slot-court" className="w-full">
            <SelectValue placeholder={courts.isError ? "No pudimos cargar las canchas" : "Elegí una cancha"} />
          </SelectTrigger>
          <SelectContent>
            {active.map((court) => (
              <SelectItem key={court.id} value={court.id}>
                {court.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormField id="slot-day" name="day" label="Fecha" type="date" defaultValue={defaults.day} required />
      <FormField id="slot-time" name="time" label="Hora de inicio" type="time" defaultValue={defaults.time} required />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="slot-duration">Duración</Label>
        <Select name="duration" defaultValue={String(duration)}>
          <SelectTrigger id="slot-duration" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durations.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {formatDuration(minutes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/** Lee los campos de `SlotFields` y arma el intervalo en UTC según la zona del club. */
export function readSlot(form: FormData, timeZone: string) {
  const startsAt = zonedToIso(String(form.get("day")), String(form.get("time")), timeZone);
  const minutes = Number(form.get("duration"));
  return {
    court_id: String(form.get("court_id")),
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(),
  };
}
