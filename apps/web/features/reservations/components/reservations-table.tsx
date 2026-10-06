"use client";

import type { ReservationOut } from "@clubsystem/api";
import { formatDate, formatMoney, formatTime, RESERVATION_SOURCE_LABELS } from "@clubsystem/shared";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { StatusBadge } from "./status-badge";

interface ReservationsTableProps {
  reservations: ReservationOut[];
  timeZone: string;
  onSelect: (reservationId: string) => void;
}

export function ReservationsTable({ reservations, timeZone, onSelect }: ReservationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Horario</TableHead>
          <TableHead>Cancha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead className="text-right">Pagado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.map((r) => (
          <TableRow key={r.id} className="cursor-pointer" onClick={() => onSelect(r.id)}>
            <TableCell>{formatDate(r.starts_at, timeZone)}</TableCell>
            <TableCell className="tabular">
              {formatTime(r.starts_at, timeZone)}–{formatTime(r.ends_at, timeZone)}
            </TableCell>
            <TableCell>{r.court_name}</TableCell>
            <TableCell>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(r.id);
                }}
              >
                {r.customer_name}
              </Button>
              <span className="block text-xs text-muted-foreground">
                {r.customer_type === "MEMBER" ? "Socio" : "Invitado"}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge status={r.status} />
            </TableCell>
            <TableCell>{RESERVATION_SOURCE_LABELS[r.source]}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(r.total_price)}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(r.paid_amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
