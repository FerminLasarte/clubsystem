"use client";

import type { ExpenseOut } from "@clubsystem/api";
import { EXPENSE_CATEGORY_LABELS, formatDateTime, formatMoney } from "@clubsystem/shared";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveSession } from "@/features/auth/api";
import { useExpense, useReviewExpense } from "@/features/expenses/api";
import { formatDay } from "@/features/expenses/labels";

import { AiExplanation } from "./ai-explanation";
import { AnomalyBadge } from "./anomaly-badge";

/** El backend une los motivos con " · ". */
function splitReasons(reasons: string | null): string[] {
  return reasons ? reasons.split(" · ").filter(Boolean) : [];
}

function AnomalyDetail({ seed, canWrite }: { seed: ExpenseOut; canWrite: boolean }) {
  const { active_club } = useActiveSession();
  const detail = useExpense(seed.id, seed);
  const expense = detail.data ?? seed;
  const review = useReviewExpense();
  const reasons = splitReasons(expense.anomaly_reasons);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalle de anomalía</DialogTitle>
        <DialogDescription>
          {EXPENSE_CATEGORY_LABELS[expense.category]} · {formatDay(expense.expense_date)} ·{" "}
          {formatMoney(expense.amount)}
          {expense.vendor_name ? ` · ${expense.vendor_name}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {detail.isError ? <FormError error={detail.error} /> : null}
        <p className="text-sm">{expense.description}</p>
        {expense.anomaly_severity ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Severidad</dt>
            <dd>
              <AnomalyBadge severity={expense.anomaly_severity} />
            </dd>
            <dt className="text-muted-foreground">Puntaje</dt>
            <dd className="tabular">{expense.anomaly_score?.toFixed(2) ?? "—"} / 1</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">El último análisis ya no marca este gasto como anómalo.</p>
        )}
        {reasons.length > 0 ? (
          <section aria-labelledby="anomaly-reasons-title" className="grid gap-1">
            <h3 id="anomaly-reasons-title" className="text-sm font-medium">
              Motivos (análisis estadístico)
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <AiExplanation expense={expense} />
        {expense.reviewed_at ? (
          <p className="text-sm text-success">Revisado el {formatDateTime(expense.reviewed_at, active_club.timezone)}.</p>
        ) : null}
      </div>
      {canWrite && expense.anomaly_severity && !expense.reviewed_at ? (
        <DialogFooter>
          <Button disabled={review.isPending} onClick={() => review.mutate(expense.id)}>
            {review.isPending ? "Guardando…" : "Marcar como revisado"}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

interface AnomalyDialogProps {
  expense: ExpenseOut | null;
  canWrite: boolean;
  onClose: () => void;
}

export function AnomalyDialog({ expense, canWrite, onClose }: AnomalyDialogProps) {
  return (
    <Dialog open={expense !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {expense ? <AnomalyDetail key={expense.id} seed={expense} canWrite={canWrite} /> : null}
      </DialogContent>
    </Dialog>
  );
}
