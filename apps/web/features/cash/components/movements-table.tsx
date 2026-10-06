"use client";

import type { AppSchemasCashMovementOut as MovementOut } from "@clubsystem/api";
import { formatMoney, formatTime, PAYMENT_METHOD_LABELS } from "@clubsystem/shared";
import { Ban } from "lucide-react";
import { useState } from "react";

import { StateView } from "@/components/shared/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { MovementTypeBadge } from "./movement-type-badge";
import { VoidDialog } from "./void-dialog";

interface MovementsTableProps {
  movements: MovementOut[];
  timeZone: string;
  canWrite: boolean;
}

function Counterpart({ movement, timeZone }: { movement: MovementOut; timeZone: string }) {
  const { member, reservation } = movement;
  if (reservation) {
    return (
      <>
        <p>{reservation.customer_name}</p>
        <p className="text-xs text-muted-foreground">
          Reserva {reservation.court_name} · {formatTime(reservation.starts_at, timeZone)}
        </p>
      </>
    );
  }
  if (member) {
    return (
      <>
        <p>{member.full_name}</p>
        {member.member_number ? <p className="text-xs text-muted-foreground">N.º {member.member_number}</p> : null}
      </>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export function MovementsTable({ movements, timeZone, canWrite }: MovementsTableProps) {
  const [toVoid, setToVoid] = useState<MovementOut | null>(null);

  if (movements.length === 0) {
    return <StateView variant="empty" title="Sin movimientos" description="No hay ingresos ni egresos en este día." />;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Socio / reserva</TableHead>
            <TableHead>Registró</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            {canWrite ? (
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const voided = movement.voided_at !== null;
            return (
              <TableRow key={movement.id} className={cn(voided && "text-muted-foreground")}>
                <TableCell className="tabular">{formatTime(movement.occurred_at, timeZone)}</TableCell>
                <TableCell>
                  <MovementTypeBadge type={movement.type} />
                </TableCell>
                <TableCell>{PAYMENT_METHOD_LABELS[movement.method]}</TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <p className={cn(voided && "line-through")}>{movement.description}</p>
                  {voided ? (
                    <p className="mt-1 text-xs">
                      <Badge variant="outline">Anulado</Badge> {movement.void_reason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Counterpart movement={movement} timeZone={timeZone} />
                </TableCell>
                <TableCell>{movement.created_by_name ?? "—"}</TableCell>
                <TableCell className={cn("tabular text-right font-medium", voided && "line-through")}>
                  {movement.type === "OUTFLOW" ? "−" : "+"}
                  {formatMoney(movement.amount)}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    {voided ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Anular movimiento: ${movement.description}`}
                        onClick={() => setToVoid(movement)}
                      >
                        <Ban className="size-4" aria-hidden />
                      </Button>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <VoidDialog movement={toVoid} onClose={() => setToVoid(null)} />
    </>
  );
}
