"use client";

import { CalendarPlus, Inbox, UserCheck, UserX } from "lucide-react";

import { QueryError } from "@/components/shared/state-view";
import { StatCard } from "@/components/shared/stat-card";
import { useMemberStats } from "@/features/members/api";

export function MemberStats() {
  const stats = useMemberStats();

  if (stats.isError) return <QueryError error={stats.error} onRetry={() => stats.refetch()} />;
  const data = stats.data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Socios activos" value={data?.approved} icon={UserCheck} tone="success" />
      <StatCard label="Altas este mes" value={data?.joined_this_month} icon={CalendarPlus} tone="info" />
      <StatCard label="Solicitudes pendientes" value={data?.pending} icon={Inbox} tone="warning" />
      <StatCard label="Dados de baja" value={data?.inactive} icon={UserX} tone="neutral" />
    </div>
  );
}
