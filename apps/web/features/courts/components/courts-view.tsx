"use client";

import type { CourtOut } from "@clubsystem/api";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession } from "@/features/auth/api";
import { useCourts, useDeleteCourt } from "@/features/courts/api";

import { CourtFormDialog } from "./court-form-dialog";
import { CourtsTable } from "./courts-table";
import { DeactivateCourtDialog } from "./deactivate-court-dialog";

/** Diálogo de alta (court null) o edición. Al cerrar se conserva la cancha para no cambiar el título en la animación. */
interface FormState {
  open: boolean;
  court: CourtOut | null;
}

export function CourtsView() {
  const { permissions } = useActiveSession();
  const canEdit = permissions.includes("courts:write");
  const courts = useCourts();
  const remove = useDeleteCourt();
  const [form, setForm] = useState<FormState>({ open: false, court: null });
  const [toDelete, setToDelete] = useState<CourtOut | null>(null);
  const [toDeactivate, setToDeactivate] = useState<CourtOut | null>(null);

  const openCreate = () => setForm({ open: true, court: null });

  return (
    <>
      <PageHeader
        title="Canchas"
        description="Tarifas por hora y disponibilidad de cada cancha. Una cancha inactiva no se puede reservar."
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> Nueva cancha
            </Button>
          ) : null
        }
      />
      {courts.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : courts.isError ? (
        <QueryError error={courts.error} onRetry={() => courts.refetch()} />
      ) : courts.data.length === 0 ? (
        <StateView
          variant="empty"
          title="Todavía no hay canchas"
          description="Cargá la primera para empezar a tomar reservas."
          action={canEdit ? { label: "Nueva cancha", onClick: openCreate } : undefined}
        />
      ) : (
        <Card>
          <CardContent>
            <CourtsTable
              courts={courts.data}
              canEdit={canEdit}
              onEdit={(court) => setForm({ open: true, court })}
              onDelete={setToDelete}
              onDeactivateWithReservations={setToDeactivate}
            />
          </CardContent>
        </Card>
      )}
      <CourtFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((prev) => ({ ...prev, open }))}
        court={form.court}
      />
      <DeactivateCourtDialog court={toDeactivate} onClose={() => setToDeactivate(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Eliminar ${toDelete?.name ?? "cancha"}`}
        description="Solo se puede eliminar una cancha sin reservas. Si tiene historial, desactivala."
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}
      />
    </>
  );
}
