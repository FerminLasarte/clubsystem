import type { MembershipStatus } from "@clubsystem/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import type { MemberListFilters } from "./api";

export const MEMBER_TABS = ["members", "requests", "plans"] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];

/** Estados que se filtran en la tabla de socios (las solicitudes tienen su pestaña). */
export const MEMBER_FILTER_STATUSES = ["APPROVED", "INACTIVE"] as const satisfies readonly MembershipStatus[];
type MemberFilterStatus = (typeof MEMBER_FILTER_STATUSES)[number];

/** Parámetros de la URL: `tab`, `q`, `status`, `plan`, `page`, `rpage` (página de solicitudes). */
type UrlPatch = Partial<Record<"tab" | "q" | "status" | "plan" | "page" | "rpage", string | null>>;
export type MemberFiltersPatch = Pick<UrlPatch, "q" | "status" | "plan">;

function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && (options as readonly string[]).includes(value);
}

function pageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Pestaña, filtros y páginas de la pantalla de socios, guardados en la URL. */
export function useMembersUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = params.get("tab");
  const rawStatus = params.get("status");
  const tab: MemberTab = isOneOf(rawTab, MEMBER_TABS) ? rawTab : "members";
  const status: MemberFilterStatus | undefined = isOneOf(rawStatus, MEMBER_FILTER_STATUSES) ? rawStatus : undefined;
  const filters: MemberListFilters = {
    search: params.get("q") ?? undefined,
    status,
    plan_id: params.get("plan") ?? undefined,
  };

  const update = useCallback(
    (patch: UrlPatch) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    tab,
    filters,
    page: pageParam(params.get("page")),
    requestsPage: pageParam(params.get("rpage")),
    update,
  };
}
