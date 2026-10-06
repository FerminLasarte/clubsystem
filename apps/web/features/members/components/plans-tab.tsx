"use client";

import type { PlanOut } from "@clubsystem/api";
import { formatMoney } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeletePlan, usePlans, useUpdatePlan } from "@/features/members/api";

import { PlanFormDialog } from "./plan-form-dialog";
import { PlanRowActions, type PlanAction } from "./plan-row-actions";

type Pending = { action: Exclude<PlanAction, "edit">; plan: PlanOut } | null;

const CONFIRM_COPY = {
  deactivate: {
    title: "Desactivar plan",
    body: "No se podrá asignar a nuevos socios y sus socios dejan de generar cuotas mientras siga desactivado.",
    label: "Desactivar",
  },
  activate: { title: "Reactivar plan", body: "Vuelve a estar disponible y a generar cuotas.", label: "Reactivar" },
  delete: {
    title: "Eliminar plan",
    body: "Si algún socio lo tiene asignado, el plan no se borra: se desactiva para conservar el historial.",
    label: "Eliminar",
  },
} as const;

export function PlansTab({ canWrite }: { canWrite: boolean }) {
  const plans = usePlans();
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [form, setForm] = useState<{ plan: PlanOut | null } | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  function onAction(action: PlanAction, plan: PlanOut) {
    if (action === "edit") setForm({ plan });
    else setPending({ action, plan });
  }

  function confirm() {
    if (!pending) return;
    const close = () => setPending(null);
    if (pending.action === "delete") {
      remove.mutate(pending.plan.id, { onSuccess: close });
      return;
    }
    const activate = pending.action === "activate";
    update.mutate(
      { id: pending.plan.id, body: { is_active: activate } },
      {
        onSuccess: () => {
          toast.success(activate ? "Plan reactivado" : "Plan desactivado");
          close();
        },
      },
    );
  }

  const copy = pending ? CONFIRM_COPY[pending.action] : null;

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button onClick={() => setForm({ plan: null })}>
            <Plus className="size-4" aria-hidden /> Nuevo plan
          </Button>
        </div>
      ) : null}
      {plans.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : plans.isError ? (
        <QueryError error={plans.error} onRetry={() => plans.refetch()} />
      ) : plans.data.length === 0 ? (
        <StateView variant="empty" title="Todavía no hay planes" description="Creá un plan para asignar cuotas a los socios." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Cuota mensual</TableHead>
              <TableHead>Estado</TableHead>
              {canWrite ? (
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.data.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="tabular text-right">{formatMoney(plan.monthly_fee)}</TableCell>
                <TableCell>
                  <Badge variant={plan.is_active ? "secondary" : "outline"}>
                    {plan.is_active ? "Activo" : "Desactivado"}
                  </Badge>
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <PlanRowActions plan={plan} onAction={onAction} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <PlanFormDialog open={form !== null} plan={form?.plan ?? null} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ""}
        description={pending && copy ? `${pending.plan.name}: ${copy.body}` : undefined}
        confirmLabel={copy?.label}
        destructive={pending?.action !== "activate"}
        pending={update.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
