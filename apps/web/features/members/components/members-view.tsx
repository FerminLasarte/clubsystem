"use client";

import { useCallback } from "react";

import { ExportButton } from "@/components/shared/export-button";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveSession } from "@/features/auth/api";
import { exportMembersCsv, useMemberStats } from "@/features/members/api";
import { MEMBER_TABS, useMembersUrlState, type MemberFiltersPatch } from "@/features/members/hooks";
import { isOneOf } from "@/lib/use-url-params";

import { InvitationsTab } from "./invitations-tab";
import { MemberCreateDialog } from "./member-create-dialog";
import { MemberStats } from "./member-stats";
import { MembersTab } from "./members-tab";
import { PlansTab } from "./plans-tab";
import { RequestsTab } from "./requests-tab";

export function MembersView() {
  const { permissions } = useActiveSession();
  const { tab, filters, page, requestsPage, invitationsPage, update } = useMembersUrlState();
  const stats = useMemberStats().data;
  const pendingCount = stats?.pending ?? 0;
  const invitedCount = stats?.invited ?? 0;
  const canWrite = permissions.includes("members:write");

  const onFiltersChange = useCallback((patch: MemberFiltersPatch) => update({ ...patch, page: null }), [update]);

  const actions =
    tab === "members" ? (
      <>
        {permissions.includes("members:export") ? (
          <ExportButton request={() => exportMembersCsv(filters)} filename="socios.csv" />
        ) : null}
        {canWrite ? <MemberCreateDialog /> : null}
      </>
    ) : null;

  return (
    <>
      <PageHeader title="Socios" description="Membresías del club, solicitudes de alta y planes." actions={actions} />
      <Tabs value={tab} onValueChange={(value) => isOneOf(value, MEMBER_TABS) && update({ tab: value === "members" ? null : value })}>
        <TabsList>
          <TabsTrigger value="members">Socios</TabsTrigger>
          <TabsTrigger value="requests">
            Solicitudes
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="tabular">
                {pendingCount}
                <span className="sr-only"> pendientes</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitaciones
            {invitedCount > 0 ? (
              <Badge variant="secondary" className="tabular">
                {invitedCount}
                <span className="sr-only"> sin responder</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="plans">Planes</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="grid gap-6 pt-4">
          <MemberStats />
          <MembersTab
            filters={filters}
            page={page}
            canWrite={canWrite}
            onFiltersChange={onFiltersChange}
            onPageChange={(next) => update({ page: next })}
          />
        </TabsContent>
        <TabsContent value="requests" className="pt-4">
          <RequestsTab
            page={requestsPage}
            canWrite={canWrite}
            onPageChange={(next) => update({ rpage: next })}
          />
        </TabsContent>
        <TabsContent value="invitations" className="pt-4">
          <InvitationsTab
            page={invitationsPage}
            canWrite={canWrite}
            onPageChange={(next) => update({ ipage: next })}
          />
        </TabsContent>
        <TabsContent value="plans" className="pt-4">
          <PlansTab canWrite={permissions.includes("plans:write")} />
        </TabsContent>
      </Tabs>
    </>
  );
}
