"use client";

import { todayIn } from "@clubsystem/shared";

import { PageHeader } from "@/components/shared/page-header";
import { useActiveSession } from "@/features/auth/api";
import { formatCalendarDate } from "@/lib/calendar";

import { FinanceSection } from "./finance-section";
import { OperationsSection } from "./operations-section";

export function DashboardView() {
  const { active_club, permissions } = useActiveSession();
  const today = todayIn(active_club.timezone);
  return (
    <>
      <PageHeader title={active_club.name} description={formatCalendarDate(today, { dateStyle: "full" })} />
      <div className="grid gap-8">
        <OperationsSection />
        {permissions.includes("dashboard:finance") ? <FinanceSection /> : null}
      </div>
    </>
  );
}
