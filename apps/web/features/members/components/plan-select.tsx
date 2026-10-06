"use client";

import { formatMoney } from "@clubsystem/shared";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlans } from "@/features/members/api";

/** Valor del ítem "Sin plan" (Radix no admite ítems con valor vacío). */
export const NO_PLAN = "none";

export function planIdFrom(value: FormDataEntryValue | null): string | null {
  const id = value?.toString() ?? "";
  return id === "" || id === NO_PLAN ? null : id;
}

interface PlanSelectProps {
  id: string;
  /** Plan actual: se ofrece aunque esté desactivado, para no obligar a cambiarlo. */
  currentPlanId?: string | null;
}

/** Selector de plan para formularios (campo `name={id}` en el FormData). Solo ofrece planes activos. */
export function PlanSelect({ id, currentPlanId }: PlanSelectProps) {
  const plans = usePlans();
  const options = (plans.data ?? []).filter((plan) => plan.is_active || plan.id === currentPlanId);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Plan</Label>
      <Select name={id} defaultValue={currentPlanId ?? NO_PLAN} disabled={plans.isPending}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PLAN}>Sin plan</SelectItem>
          {options.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.name} · {formatMoney(plan.monthly_fee)}
              {plan.is_active ? "" : " (desactivado)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {plans.isError ? (
        <p role="alert" className="text-xs text-destructive">
          No se pudieron cargar los planes.
        </p>
      ) : null}
    </div>
  );
}
