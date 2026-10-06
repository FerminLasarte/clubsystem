"use client";

import type { FeeStatus } from "@clubsystem/api";
import { FEE_STATUS_LABELS, monthLabel, todayIn, yearMonthOf } from "@clubsystem/shared";
import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { useActiveSession } from "@/features/auth/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { pageParam, useUrlParams } from "@/lib/use-url-params";

import { FeesFilters } from "./fees-filters";
import { FeesList } from "./fees-list";
import { FeesSummaryCards } from "./fees-summary";
import { GenerateDialog } from "./generate-dialog";
import { PeriodPicker } from "./period-picker";

function intParam(value: string | null, min: number, max: number): number | null {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function statusParam(value: string | null): FeeStatus | null {
  return value !== null && Object.hasOwn(FEE_STATUS_LABELS, value) ? (value as FeeStatus) : null;
}

export function FeesView() {
  const { active_club, permissions } = useActiveSession();
  const [params, setParams] = useUrlParams();
  const current = yearMonthOf(todayIn(active_club.timezone));
  const year = intParam(params.get("year"), 2000, 2100) ?? current.year;
  const month = intParam(params.get("month"), 1, 12) ?? current.month;
  const status = statusParam(params.get("status"));
  const page = pageParam(params);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const canWrite = permissions.includes("fees:write");

  return (
    <>
      <PageHeader
        title="Cuotas"
        description={`Cuotas de ${monthLabel(year, month)}`}
        actions={canWrite ? <GenerateDialog year={year} month={month} /> : null}
      />
      <div className="grid gap-6">
        <PeriodPicker year={year} month={month} onChange={(next) => setParams({ ...next, page: null })} />
        <FeesSummaryCards year={year} month={month} />
        <FeesFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            if (params.has("page")) setParams({ page: null });
          }}
          status={status}
          onStatusChange={(value) => setParams({ status: value, page: null })}
        />
        <FeesList
          filters={{ year, month, status, search: debouncedSearch, page }}
          canWrite={canWrite}
          onPageChange={(next) => setParams({ page: next === 1 ? null : next })}
        />
      </div>
    </>
  );
}
