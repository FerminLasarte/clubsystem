"use client";

import { errorMessage, type MemberOut } from "@clubsystem/api";
import { X } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useMemberSearch } from "@/features/cash/api";

import { useDebouncedValue } from "@/lib/use-debounced-value";

function memberLabel(member: MemberOut): string {
  const name = `${member.user.first_name} ${member.user.last_name}`;
  return member.member_number ? `${name} · N.º ${member.member_number}` : name;
}

function SearchResults({ search, onPick }: { search: string; onPick: (member: MemberOut) => void }) {
  const results = useMemberSearch(search);
  if (search.trim().length < 2) {
    return <p className="text-xs text-muted-foreground">Escribí al menos 2 letras del nombre, DNI o número.</p>;
  }
  if (results.isPending) return <p className="text-xs text-muted-foreground">Buscando…</p>;
  if (results.isError) return <p className="text-xs text-destructive">{errorMessage(results.error)}</p>;
  if (results.data.items.length === 0) return <p className="text-xs text-muted-foreground">Sin resultados.</p>;
  return (
    <ul aria-label="Socios encontrados" className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-1">
      {results.data.items.map((member) => (
        <li key={member.id}>
          <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => onPick(member)}>
            {memberLabel(member)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Socio opcional con búsqueda en el servidor. Envía `membership_id` como campo oculto del form. */
export function MemberPicker() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemberOut | null>(null);
  const debounced = useDebouncedValue(search);

  if (selected) {
    // Sin campo editable: "Socio" titula el grupo en vez de ser un <label> sin control.
    return (
      <fieldset>
        <legend className="mb-1.5 text-sm leading-none font-medium">Socio</legend>
        <input type="hidden" name="membership_id" value={selected.id} />
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="truncate">{memberLabel(selected)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar socio"
            onClick={() => setSelected(null)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </fieldset>
    );
  }

  return (
    <div className="grid gap-2">
      <FormField
        id="member-search"
        label="Socio (opcional)"
        type="search"
        autoComplete="off"
        placeholder="Buscar por nombre, DNI o número"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        // Enter en la búsqueda no envía el formulario del movimiento.
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
      />
      <SearchResults
        search={debounced}
        onPick={(member) => {
          setSelected(member);
          setSearch("");
        }}
      />
    </div>
  );
}
