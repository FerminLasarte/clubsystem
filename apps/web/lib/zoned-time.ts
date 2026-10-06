/** Minutos de diferencia entre la hora de `timeZone` y UTC en el instante `utcMs`. */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return Math.round((wallAsUtc - utcMs) / 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha ("YYYY-MM-DD") y hora ("HH:MM") de pared en la zona del club → ISO 8601 con offset
 * (p. ej. "2026-10-06T23:59:00-03:00"). No depende de la zona horaria del navegador.
 */
export function zonedDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Dos pasadas: el offset se recalcula en el instante resultante (cambios de horario).
  const guess = offsetMinutes(wallAsUtc, timeZone);
  const offset = offsetMinutes(wallAsUtc - guess * 60_000, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${date}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
