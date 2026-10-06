"use client";

import type { MemberOut } from "@clubsystem/api";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE, useMembers, useUpdateMember, type MemberListFilters } from "@/features/members/api";
import type { MemberFiltersPatch } from "@/features/members/hooks";

import { MemberEditDialog } from "./member-edit-dialog";
import { MemberFilters } from "./member-filters";
import type { MemberAction } from "./member-row-actions";
import { MembersTable } from "./members-table";

interface MembersTabProps {
  filters: MemberListFilters;
  page: number;
  canWrite: boolean;
  onFiltersChange: (patch: MemberFiltersPatch) => void;
  onPageChange: (page: number) => void;
}

export function MembersTab({ filters, page, canWrite, onFiltersChange, onPageChange }: MembersTabProps) {
  const members = useMembers(filters, page);
  const updateStatus = useUpdateMember();
  const [editing, setEditing] = useState<MemberOut | null>(null);
  const [toggling, setToggling] = useState<MemberOut | null>(null);
  const hasFilters = Boolean(filters.search || filters.status || filters.plan_id);

  function onAction(action: MemberAction, member: MemberOut) {
    if (action === "edit") setEditing(member);
    else setToggling(member);
  }

  function confirmToggle() {
    if (!toggling) return;
    const deactivate = toggling.status === "APPROVED";
    updateStatus.mutate(
      { id: toggling.id, body: { status: deactivate ? "INACTIVE" : "APPROVED" } },
      {
        onSuccess: () => {
          toast.success(deactivate ? "Socio dado de baja" : "Socio reactivado");
          setToggling(null);
        },
      },
    );
  }

  const togglingName = toggling ? `${toggling.user.first_name} ${toggling.user.last_name}` : "";
  const deactivating = toggling?.status === "APPROVED";

  return (
    <div className="grid gap-4">
      <MemberFilters filters={filters} onChange={onFiltersChange} />
      {members.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : members.isError ? (
        <QueryError error={members.error} onRetry={() => members.refetch()} />
      ) : members.data.items.length === 0 ? (
        <StateView
          variant="empty"
          title={hasFilters ? "Ningún socio coincide con los filtros" : "Todavía no hay socios"}
          description={hasFilters ? "Probá con otra búsqueda o quitá filtros." : undefined}
        />
      ) : (
        <div className={members.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <MembersTable members={members.data.items} canWrite={canWrite} onAction={onAction} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={members.data.total} onPageChange={onPageChange} />
        </div>
      )}
      <MemberEditDialog member={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={deactivating ? "Dar de baja" : "Reactivar socio"}
        description={
          deactivating
            ? `${togglingName} dejará de figurar como socio activo. Su historial se conserva y podés reactivarlo cuando quieras.`
            : `${togglingName} vuelve a figurar como socio activo.`
        }
        confirmLabel={deactivating ? "Dar de baja" : "Reactivar"}
        destructive={deactivating}
        pending={updateStatus.isPending}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
