"use client";

import { formatDay, isIsoDay, todayIn } from "@clubsystem/shared";

import { PageHeader } from "@/components/shared/page-header";
import { QueryError } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession } from "@/features/auth/api";
import { useCashDay } from "@/features/cash/api";
import { useUrlParams } from "@/lib/use-url-params";

import { CashSummaryCards } from "./cash-summary";
import { DayNav } from "./day-nav";
import { MethodTotalsTable } from "./method-totals";
import { MovementDialog } from "./movement-dialog";
import { MovementsTable } from "./movements-table";

export function CashView() {
  const { active_club, permissions } = useActiveSession();
  const [params, setParams] = useUrlParams();
  const today = todayIn(active_club.timezone);
  const requested = params.get("date");
  const date = isIsoDay(requested) ? requested : today;
  const day = useCashDay(date);
  const canWrite = permissions.includes("cash:write");

  return (
    <>
      <PageHeader
        title="Caja"
        description={formatDay(date, { dateStyle: "full" })}
        actions={canWrite ? <MovementDialog canPickMember={permissions.includes("members:read")} /> : null}
      />
      <div className="grid gap-6">
        <DayNav date={date} today={today} onChange={(next) => setParams({ date: next === today ? null : next })} />
        {day.isError ? (
          <QueryError error={day.error} onRetry={() => day.refetch()} />
        ) : (
          <>
            <CashSummaryCards summary={day.data?.summary} />
            {day.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <MethodTotalsTable totals={day.data.summary.by_method} />
                <MovementsTable movements={day.data.movements} timeZone={day.data.timezone} canWrite={canWrite} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
