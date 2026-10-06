"use client";

import type { FeeOut } from "@clubsystem/api";
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABELS } from "@clubsystem/shared";
import { Ban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";
import { formatCalendarDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

import { FeeStatusBadge } from "./fee-status-badge";

interface FeesTableProps {
  fees: FeeOut[];
  canWrite: boolean;
  onPay: (fee: FeeOut) => void;
  onCancel: (fee: FeeOut) => void;
}

export function FeesTable({ fees, canWrite, onPay, onCancel }: FeesTableProps) {
  const { timezone } = useActiveSession().active_club;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Socio</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Cobro</TableHead>
          {canWrite ? (
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fees.map((fee) => (
          <TableRow key={fee.id} className={cn(fee.is_overdue && "bg-destructive/5")}>
            <TableCell>
              <p className="font-medium">{fee.member_name}</p>
              {fee.member_number ? <p className="text-xs text-muted-foreground">N.º {fee.member_number}</p> : null}
            </TableCell>
            <TableCell>{fee.plan_name}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(fee.amount)}</TableCell>
            <TableCell>
              <span className={cn(fee.is_overdue && "font-medium text-destructive")}>
                {formatCalendarDate(fee.due_date)}
              </span>
              {fee.is_overdue ? (
                <Badge variant="destructive" className="ml-2">
                  Vencida
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>
              <FeeStatusBadge status={fee.status} />
            </TableCell>
            <TableCell className="text-sm">
              {fee.paid_at ? (
                <>
                  <p>{formatDateTime(fee.paid_at, timezone)}</p>
                  {fee.payment_method ? (
                    <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[fee.payment_method]}</p>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            {canWrite ? (
              <TableCell className="text-right whitespace-nowrap">
                {fee.status === "PENDING" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onPay(fee)}>
                      Cobrar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-1"
                      aria-label={`Anular cuota de ${fee.member_name}`}
                      onClick={() => onCancel(fee)}
                    >
                      <Ban className="size-4" aria-hidden />
                    </Button>
                  </>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
