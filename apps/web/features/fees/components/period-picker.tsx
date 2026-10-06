"use client";

import { SelectField } from "@/components/shared/select-field";

interface PeriodPickerProps {
  year: number;
  month: number;
  onChange: (period: { year: number; month: number }) => void;
}

const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });

const MONTHS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => {
    const name = monthName.format(new Date(Date.UTC(2000, i, 1)));
    return [String(i + 1), name.charAt(0).toUpperCase() + name.slice(1)];
  }),
);

/** El año elegido ± 2, para poder moverse sin límite de a pasos. */
function yearOptions(year: number): Record<string, string> {
  return Object.fromEntries(Array.from({ length: 5 }, (_, i) => String(year - 2 + i)).map((y) => [y, y]));
}

export function PeriodPicker({ year, month, onChange }: PeriodPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <SelectField
        id="fees-month"
        label="Mes"
        options={MONTHS}
        value={String(month)}
        onValueChange={(value) => onChange({ year, month: Number(value) })}
        className="w-40"
      />
      <SelectField
        id="fees-year"
        label="Año"
        options={yearOptions(year)}
        value={String(year)}
        onValueChange={(value) => onChange({ year: Number(value), month })}
        className="w-28"
      />
    </div>
  );
}
