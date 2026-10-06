import type { MembershipStatus } from "@clubsystem/api";
import { isOneOf, pageParam, useUrlParams } from "@/lib/use-url-params";

import type { MemberListFilters } from "./api";

export const MEMBER_TABS = ["members", "requests", "invitations", "plans"] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];

/** Estados que se filtran en la tabla de socios (las solicitudes tienen su pestaña). */
export const MEMBER_FILTER_STATUSES = ["APPROVED", "INACTIVE"] as const satisfies readonly MembershipStatus[];

/** Parámetros de la URL: `tab`, `q`, `status`, `plan`, `page`, `rpage` (solicitudes), `ipage` (invitaciones). */
type UrlPatch = Partial<Record<"tab" | "q" | "status" | "plan" | "page" | "rpage" | "ipage", string | number | null>>;
export type MemberFiltersPatch = Pick<UrlPatch, "q" | "status" | "plan">;

/** Pestaña, filtros y páginas de la pantalla de socios, guardados en la URL. */
export function useMembersUrlState() {
  const [params, setParams] = useUrlParams();

  const rawTab = params.get("tab");
  const rawStatus = params.get("status");
  const tab: MemberTab = isOneOf(rawTab, MEMBER_TABS) ? rawTab : "members";
  const filters: MemberListFilters = {
    search: params.get("q") ?? undefined,
    status: isOneOf(rawStatus, MEMBER_FILTER_STATUSES) ? rawStatus : undefined,
    plan_id: params.get("plan") ?? undefined,
  };

  const update: (patch: UrlPatch) => void = setParams;

  return {
    tab,
    filters,
    page: pageParam(params),
    requestsPage: pageParam(params, "rpage"),
    invitationsPage: pageParam(params, "ipage"),
    update,
  };
}
