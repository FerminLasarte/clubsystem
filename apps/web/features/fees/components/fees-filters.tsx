"use client";

import type { FeeStatus } from "@clubsystem/api";
import { FEE_STATUS_LABELS } from "@clubsystem/shared";

import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";

const ALL = "ALL";
const STATUS_OPTIONS = { [ALL]: "Todos los estados", ...FEE_STATUS_LABELS };

interface FeesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: FeeStatus | null;
  onStatusChange: (value: FeeStatus | null) => void;
}

export function FeesFilters({ search, onSearchChange, status, onStatusChange }: FeesFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-72">
        <FormField
          id="fees-search"
          label="Buscar socio"
          type="search"
          placeholder="Nombre o número de socio"
          maxLength={100}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <SelectField
        id="fees-status"
        label="Estado"
        options={STATUS_OPTIONS}
        value={status ?? ALL}
        onValueChange={(value) => onStatusChange(value === ALL ? null : value)}
        className="w-48"
      />
    </div>
  );
}
