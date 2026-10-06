"use client";

import { MEMBERSHIP_STATUS_LABELS } from "@clubsystem/shared";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlans, type MemberListFilters } from "@/features/members/api";
import { MEMBER_FILTER_STATUSES, type MemberFiltersPatch } from "@/features/members/hooks";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const ALL = "all";

interface MemberFiltersProps {
  filters: MemberListFilters;
  /** Cada cambio de filtro vuelve a la página 1. */
  onChange: (patch: MemberFiltersPatch) => void;
}

export function MemberFilters({ filters, onChange }: MemberFiltersProps) {
  const plans = usePlans();
  const [search, setSearch] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(search.trim());

  // La búsqueda se escribe en la URL recién cuando el usuario deja de tipear.
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? "")) onChange({ q: debouncedSearch || null });
  }, [debouncedSearch, filters.search, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="member-search">Buscar</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="member-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, email, DNI o n° de socio"
            className="pl-8"
            maxLength={100}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="member-status">Estado</Label>
        <Select value={filters.status ?? ALL} onValueChange={(value) => onChange({ status: value === ALL ? null : value })}>
          <SelectTrigger id="member-status" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {MEMBER_FILTER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {MEMBERSHIP_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="member-plan">Plan</Label>
        <Select value={filters.plan_id ?? ALL} onValueChange={(value) => onChange({ plan: value === ALL ? null : value })}>
          <SelectTrigger id="member-plan" className="w-full sm:w-48" disabled={plans.isError}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los planes</SelectItem>
            {plans.data?.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
                {plan.is_active ? "" : " (desactivado)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
