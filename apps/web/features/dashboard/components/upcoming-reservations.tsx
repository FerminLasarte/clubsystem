"use client";

import type { UpcomingReservation } from "@clubsystem/api";
import { formatTime, RESERVATION_STATUS_LABELS } from "@clubsystem/shared";
import Link from "next/link";

import { StateView } from "@/components/shared/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveSession } from "@/features/auth/api";

interface UpcomingReservationsProps {
  reservations: UpcomingReservation[];
  className?: string;
}

/** Reservas del día que todavía no terminaron (en curso o por empezar). */
export function UpcomingReservations({ reservations, className }: UpcomingReservationsProps) {
  const { active_club, permissions } = useActiveSession();
  const timeZone = active_club.timezone;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Próximas reservas</CardTitle>
        {permissions.includes("reservations:read") ? (
          <CardAction>
            <Button variant="link" size="sm" asChild>
              <Link href="/reservations">Ver reservas</Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <StateView variant="empty" title="No quedan reservas por hoy" />
        ) : (
          <ul className="divide-y">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="tabular font-medium">
                    {formatTime(reservation.starts_at, timeZone)}–{formatTime(reservation.ends_at, timeZone)} ·{" "}
                    {reservation.court_name}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {reservation.customer_name}
                    {reservation.customer_type === "GUEST" ? " (invitado)" : ""}
                  </p>
                </div>
                <Badge variant={reservation.status === "confirmed" ? "secondary" : "outline"}>
                  {RESERVATION_STATUS_LABELS[reservation.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
