"use client";

import type { MemberOut } from "@clubsystem/api";
import { formatDateTime } from "@clubsystem/shared";
import { Check, X } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";
import { PAGE_SIZE, useMembershipRequests, useRejectRequest } from "@/features/members/api";

import { ApproveRequestDialog } from "./approve-request-dialog";

interface RequestsTabProps {
  page: number;
  canWrite: boolean;
  onPageChange: (page: number) => void;
}

export function RequestsTab({ page, canWrite, onPageChange }: RequestsTabProps) {
  const timeZone = useActiveSession().active_club.timezone;
  const requests = useMembershipRequests(page);
  const reject = useRejectRequest();
  const [approving, setApproving] = useState<MemberOut | null>(null);
  const [rejecting, setRejecting] = useState<MemberOut | null>(null);

  if (requests.isPending) return <Skeleton className="h-60 w-full" />;
  if (requests.isError) return <QueryError error={requests.error} onRetry={() => requests.refetch()} />;
  if (requests.data.items.length === 0) {
    return <StateView variant="empty" title="No hay solicitudes pendientes" />;
  }

  return (
    <div className={requests.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Solicitada</TableHead>
            {canWrite ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.data.items.map((request) => {
            const name = `${request.user.first_name} ${request.user.last_name}`;
            return (
              <TableRow key={request.id}>
                <TableCell>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{request.user.email}</p>
                </TableCell>
                <TableCell className="tabular">{request.user.dni ?? "—"}</TableCell>
                <TableCell>{request.user.phone ?? "—"}</TableCell>
                <TableCell>{request.requested_at ? formatDateTime(request.requested_at, timeZone) : "—"}</TableCell>
                {canWrite ? (
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" onClick={() => setApproving(request)} aria-label={`Aprobar a ${name}`}>
                      <Check className="size-4" aria-hidden /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejecting(request)} aria-label={`Rechazar a ${name}`}>
                      <X className="size-4" aria-hidden /> Rechazar
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={requests.data.total} onPageChange={onPageChange} />
      <ApproveRequestDialog request={approving} onClose={() => setApproving(null)} />
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Rechazar solicitud"
        description={`${rejecting?.user.first_name ?? ""} ${rejecting?.user.last_name ?? ""} no será socio del club. Podrá volver a pedirlo más adelante.`}
        confirmLabel="Rechazar"
        destructive
        pending={reject.isPending}
        onConfirm={() => rejecting && reject.mutate(rejecting.id, { onSuccess: () => setRejecting(null) })}
      />
    </div>
  );
}
