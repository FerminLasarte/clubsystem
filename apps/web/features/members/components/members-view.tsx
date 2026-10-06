"use client";

import { Download } from "lucide-react";
import { useCallback } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveSession } from "@/features/auth/api";
import { membersExportUrl, useMemberStats } from "@/features/members/api";
import { MEMBER_TABS, useMembersUrlState, type MemberFiltersPatch, type MemberTab } from "@/features/members/hooks";

import { InvitationsTab } from "./invitations-tab";
import { MemberCreateDialog } from "./member-create-dialog";
import { MemberStats } from "./member-stats";
import { MembersTab } from "./members-tab";
import { PlansTab } from "./plans-tab";
import { RequestsTab } from "./requests-tab";

function isMemberTab(value: string): value is MemberTab {
  return (MEMBER_TABS as readonly string[]).includes(value);
}

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
          <Button variant="outline" asChild>
            <a href={membersExportUrl(filters)} download>
              <Download className="size-4" aria-hidden /> Exportar CSV
            </a>
          </Button>
        ) : null}
        {canWrite ? <MemberCreateDialog /> : null}
      </>
    ) : null;

  return (
    <>
      <PageHeader title="Socios" description="Membresías del club, solicitudes de alta y planes." actions={actions} />
      <Tabs value={tab} onValueChange={(value) => isMemberTab(value) && update({ tab: value === "members" ? null : value })}>
        <TabsList>
          <TabsTrigger value="members">Socios</TabsTrigger>
          <TabsTrigger value="requests">
            Solicitudes
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="tabular" aria-label={`${pendingCount} pendientes`}>
                {pendingCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitaciones
            {invitedCount > 0 ? (
              <Badge variant="secondary" className="tabular" aria-label={`${invitedCount} sin responder`}>
                {invitedCount}
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
            onPageChange={(next) => update({ page: String(next) })}
          />
        </TabsContent>
        <TabsContent value="requests" className="pt-4">
          <RequestsTab
            page={requestsPage}
            canWrite={canWrite}
            onPageChange={(next) => update({ rpage: String(next) })}
          />
        </TabsContent>
        <TabsContent value="invitations" className="pt-4">
          <InvitationsTab
            page={invitationsPage}
            canWrite={canWrite}
            onPageChange={(next) => update({ ipage: String(next) })}
          />
        </TabsContent>
        <TabsContent value="plans" className="pt-4">
          <PlansTab canWrite={permissions.includes("plans:write")} />
        </TabsContent>
      </Tabs>
    </>
  );
}
