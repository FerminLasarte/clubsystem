"use client";

import { errorMessage, type MemberOut } from "@clubsystem/api";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useMemberSearch } from "@/features/reservations/api";

import { useDebouncedValue } from "@/lib/use-debounced-value";

function fullName(member: MemberOut): string {
  return `${member.user.first_name} ${member.user.last_name}`;
}

function MemberLine({ member }: { member: MemberOut }) {
  return (
    <span className="min-w-0 text-left">
      <span className="block truncate font-medium">{fullName(member)}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {member.member_number ? `Socio N.º ${member.member_number} · ` : ""}
        {member.user.email}
      </span>
    </span>
  );
}

interface MemberPickerProps {
  value: MemberOut | null;
  onChange: (member: MemberOut | null) => void;
}

/** Autocompletado de socios activos: busca en el servidor con debounce. */
export function MemberPicker({ value, onChange }: MemberPickerProps) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const results = useMemberSearch(debounced);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <MemberLine member={value} />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <FormField
        id="member-search"
        label="Socio"
        placeholder="Nombre, email, DNI o N.º de socio"
        hint="Escribí al menos 2 caracteres."
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {debounced.length < 2 ? null : results.isPending ? (
        <p className="text-sm text-muted-foreground">Buscando…</p>
      ) : results.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(results.error)}
        </p>
      ) : results.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay socios activos que coincidan.</p>
      ) : (
        <ul aria-label="Resultados" className="max-h-56 overflow-y-auto rounded-md border">
          {results.data.map((member) => (
            <li key={member.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-3 py-2"
                onClick={() => onChange(member)}
              >
                <MemberLine member={member} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
