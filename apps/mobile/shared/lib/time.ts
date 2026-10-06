/** Zona horaria del dispositivo. Solo para datos que no traen la zona del club. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
