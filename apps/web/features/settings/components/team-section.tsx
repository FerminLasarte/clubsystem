"use client";

import type { StaffMemberOut } from "@clubsystem/api";
import { STAFF_ROLE_LABELS } from "@clubsystem/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { QueryError } from "@/components/shared/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRevokeStaff, useStaff } from "@/features/settings/api";

import { InviteDialog } from "./invite-dialog";

function isEditable(member: StaffMemberOut): boolean {
  return !member.is_self && !member.roles.includes("OWNER");
}

export function TeamSection() {
  const staff = useStaff();
  const revoke = useRevokeStaff();
  const [toRevoke, setToRevoke] = useState<StaffMemberOut | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>Quiénes acceden al panel y con qué rol.</CardDescription>
        </div>
        <InviteDialog />
      </CardHeader>
      <CardContent>
        {staff.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : staff.isError ? (
          <QueryError error={staff.error} onRetry={() => staff.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.data.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <p className="font-medium">{member.full_name ?? "Invitación pendiente"}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {member.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {STAFF_ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === "ACTIVE" ? "default" : "outline"}>
                      {member.status === "ACTIVE" ? "Activo" : "Invitado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isEditable(member) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Revocar acceso de ${member.email}`}
                        onClick={() => setToRevoke(member)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title="Revocar acceso"
        description={`${toRevoke?.email ?? ""} dejará de acceder al panel de inmediato.`}
        confirmLabel="Revocar"
        destructive
        pending={revoke.isPending}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.id, { onSuccess: () => setToRevoke(null) })}
      />
    </Card>
  );
}
