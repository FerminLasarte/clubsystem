"use client";

import type { MemberInvitationOut } from "@clubsystem/api";
import { formatDateTime } from "@clubsystem/shared";
import { X } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";
import { PAGE_SIZE, useCancelInvitation, useMemberInvitations } from "@/features/members/api";

interface InvitationsTabProps {
  page: number;
  canWrite: boolean;
  onPageChange: (page: number) => void;
}

/** Invitaciones que todavía no fueron aceptadas: solo el email (sin datos de la persona). */
export function InvitationsTab({ page, canWrite, onPageChange }: InvitationsTabProps) {
  const timeZone = useActiveSession().active_club.timezone;
  const invitations = useMemberInvitations(page);
  const cancel = useCancelInvitation();
  const [canceling, setCanceling] = useState<MemberInvitationOut | null>(null);

  if (invitations.isPending) return <Skeleton className="h-60 w-full" />;
  if (invitations.isError) return <QueryError error={invitations.error} onRetry={() => invitations.refetch()} />;
  if (invitations.data.items.length === 0) {
    return (
      <StateView
        variant="empty"
        title="No hay invitaciones pendientes"
        description="Las personas invitadas aparecen acá hasta que aceptan desde la app."
      />
    );
  }

  return (
    <div className={invitations.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>N° socio</TableHead>
            <TableHead>Invitado</TableHead>
            {canWrite ? <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.data.items.map((invitation) => (
            <TableRow key={invitation.membership_id}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell>{invitation.plan?.name ?? "—"}</TableCell>
              <TableCell className="tabular">{invitation.member_number ?? "—"}</TableCell>
              <TableCell>{invitation.invited_at ? formatDateTime(invitation.invited_at, timeZone) : "—"}</TableCell>
              {canWrite ? (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Cancelar la invitación a ${invitation.email}`}
                    onClick={() => setCanceling(invitation)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={invitations.data.total} onPageChange={onPageChange} />
      <ConfirmDialog
        open={canceling !== null}
        onOpenChange={(open) => !open && setCanceling(null)}
        title="Cancelar invitación"
        description={`${canceling?.email ?? ""} ya no podrá aceptarla desde la app.`}
        confirmLabel="Cancelar invitación"
        destructive
        pending={cancel.isPending}
        onConfirm={() => canceling && cancel.mutate(canceling.membership_id, { onSuccess: () => setCanceling(null) })}
      />
    </div>
  );
}
