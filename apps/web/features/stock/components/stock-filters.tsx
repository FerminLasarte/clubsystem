"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStockCategories, type StockFilters as Filters } from "@/features/stock/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const ALL = "__all";

interface StockFiltersProps {
  filters: Filters;
  onChange: (changes: Partial<Filters>) => void;
}

export function StockFilters({ filters, onChange }: StockFiltersProps) {
  const categories = useStockCategories();
  const [search, setSearch] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(search.trim());

  const sentSearch = useRef(filters.search);

  // La búsqueda se escribe en la URL recién cuando el usuario deja de tipear.
  useEffect(() => {
    if (debouncedSearch === sentSearch.current) return;
    sentSearch.current = debouncedSearch;
    onChange({ search: debouncedSearch });
  }, [debouncedSearch, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Buscar ítems"
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>
      <Select
        value={filters.category || ALL}
        onValueChange={(value) => onChange({ category: value === ALL ? "" : value })}
      >
        <SelectTrigger aria-label="Categoría" className="sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {categories.data?.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label className="font-normal">
        <Checkbox checked={filters.lowStock} onCheckedChange={(checked) => onChange({ lowStock: checked === true })} />
        Solo stock bajo
      </Label>
    </div>
  );
}
