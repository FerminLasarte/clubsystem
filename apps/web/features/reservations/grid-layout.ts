import type { ReservationGridOut, ReservationOut } from "@clubsystem/api";

import { localParts, timeToMinutes } from "./time";

const DAY_MINUTES = 24 * 60;

export interface GridBlock {
  reservation: ReservationOut;
  /** Minutos desde las 00:00 del día de la grilla, recortados al día. */
  start: number;
  end: number;
}

export interface GridLayout {
  /** Inicio de cada franja (minutos desde las 00:00). */
  rows: number[];
  first: number;
  slot: number;
  blocks: Map<string, GridBlock[]>;
}

function blockOf(reservation: ReservationOut, day: string, timeZone: string): GridBlock {
  const start = localParts(reservation.starts_at, timeZone);
  const end = localParts(reservation.ends_at, timeZone);
  return {
    reservation,
    start: start.day < day ? 0 : start.minutes,
    end: end.day > day ? DAY_MINUTES : end.minutes,
  };
}

/**
 * Filas = franjas del horario del club (NULL = 00:00 / 24:00). Si alguna reserva quedó fuera
 * (p. ej. el club cambió su horario), la grilla se extiende para mostrarla.
 */
export function gridLayout(grid: ReservationGridOut): GridLayout {
  const slot = grid.slot_minutes;
  const blocks = new Map<string, GridBlock[]>();
  let first = grid.open_time ? timeToMinutes(grid.open_time) : 0;
  let last = grid.close_time ? timeToMinutes(grid.close_time) : DAY_MINUTES;

  for (const court of grid.courts) {
    const courtBlocks = court.reservations.map((r) => blockOf(r, grid.date, grid.timezone));
    for (const block of courtBlocks) {
      first = Math.min(first, Math.floor(block.start / slot) * slot);
      last = Math.max(last, Math.ceil(block.end / slot) * slot);
    }
    blocks.set(court.id, courtBlocks);
  }

  const rows: number[] = [];
  for (let minute = first; minute < last; minute += slot) rows.push(minute);
  return { rows, first, slot, blocks };
}
