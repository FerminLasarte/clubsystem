"use client";

import { errorMessage, type MembershipStatus, type MemberOut } from "@clubsystem/api";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useMemberSearch } from "@/features/members/api";
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

function SearchResults({
  search,
  status,
  onPick,
}: {
  search: string;
  status?: MembershipStatus;
  onPick: (member: MemberOut) => void;
}) {
  const results = useMemberSearch(search, status);
  if (search.length < 2) return null;
  if (results.isPending) return <p className="text-sm text-muted-foreground">Buscando…</p>;
  if (results.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(results.error)}
      </p>
    );
  }
  if (results.data.length === 0) return <p className="text-sm text-muted-foreground">No hay socios que coincidan.</p>;
  return (
    <ul aria-label="Resultados" className="max-h-56 overflow-y-auto rounded-md border">
      {results.data.map((member) => (
        <li key={member.id}>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start rounded-none px-3 py-2"
            onClick={() => onPick(member)}
          >
            <MemberLine member={member} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface MemberPickerProps {
  value: MemberOut | null;
  onChange: (member: MemberOut | null) => void;
  label?: string;
  /** Solo socios en este estado (por ejemplo `APPROVED` para reservar). Sin él, busca en todos. */
  status?: MembershipStatus;
}

/** Autocompletado de socios: busca en el servidor con debounce. */
export function MemberPicker({ value, onChange, label = "Socio", status }: MemberPickerProps) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());

  if (value) {
    // Sin campo editable: el título va en un legend, no en un <label> sin control.
    return (
      <fieldset>
        <legend className="mb-1.5 text-sm leading-none font-medium">{label}</legend>
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <MemberLine member={value} />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        </div>
      </fieldset>
    );
  }

  return (
    <div className="grid gap-2">
      <FormField
        id="member-search"
        label={label}
        type="search"
        placeholder="Nombre, email, DNI o N.º de socio"
        hint="Escribí al menos 2 caracteres."
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        // Enter en la búsqueda no envía el formulario que lo contiene.
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
      />
      <SearchResults
        search={debounced}
        status={status}
        onPick={(member) => {
          onChange(member);
          setSearch("");
        }}
      />
    </div>
  );
}
