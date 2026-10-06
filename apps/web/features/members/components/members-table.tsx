"use client";

import type { MemberOut } from "@clubsystem/api";
import { formatDate, formatDateTime, MEMBERSHIP_STATUS_LABELS } from "@clubsystem/shared";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";
import { formatRelativeDay } from "@/features/members/format";

import { MemberRowActions, type MemberAction } from "./member-row-actions";

interface MembersTableProps {
  members: MemberOut[];
  canWrite: boolean;
  onAction: (action: MemberAction, member: MemberOut) => void;
}

export function MembersTable({ members, canWrite, onAction }: MembersTableProps) {
  const timeZone = useActiveSession().active_club.timezone;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Socio</TableHead>
          <TableHead>DNI</TableHead>
          <TableHead>N° socio</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Alta</TableHead>
          <TableHead>Última reserva</TableHead>
          <TableHead>Estado</TableHead>
          {canWrite ? (
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <p className="font-medium">
                {member.user.first_name} {member.user.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{member.user.email}</p>
            </TableCell>
            <TableCell className="tabular">{member.user.dni ?? "—"}</TableCell>
            <TableCell className="tabular">{member.member_number ?? "—"}</TableCell>
            <TableCell>{member.plan?.name ?? <span className="text-muted-foreground">Sin plan</span>}</TableCell>
            {/* joined_on es una fecha de calendario (sin hora): se formatea en UTC para no correr el día. */}
            <TableCell>{member.joined_on ? formatDate(member.joined_on, "UTC") : "—"}</TableCell>
            <TableCell>
              {member.last_reservation_at ? (
                <time
                  dateTime={member.last_reservation_at}
                  title={formatDateTime(member.last_reservation_at, timeZone)}
                >
                  {formatRelativeDay(member.last_reservation_at, timeZone)}
                </time>
              ) : (
                <span className="text-muted-foreground">Sin reservas</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={member.status === "APPROVED" ? "secondary" : "outline"}>
                {MEMBERSHIP_STATUS_LABELS[member.status]}
              </Badge>
            </TableCell>
            {canWrite ? (
              <TableCell>
                <MemberRowActions member={member} onAction={onAction} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
