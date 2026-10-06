"use client";

import type { StockItemOut, StockUnit } from "@clubsystem/api";
import { STOCK_UNIT_LABELS } from "@clubsystem/shared";

import { FormField } from "@/components/shared/form-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStockCategories } from "@/features/stock/api";

const UNITS = Object.keys(STOCK_UNIT_LABELS) as StockUnit[];

/** Campos comunes de alta y edición. La cantidad no está: cambia solo con movimientos. */
export function StockItemFields({ item }: { item?: StockItemOut }) {
  const categories = useStockCategories();
  return (
    <>
      <FormField
        id="name"
        label="Nombre"
        defaultValue={item?.name}
        required
        minLength={2}
        maxLength={255}
        className="sm:col-span-2"
      />
      <FormField id="sku" label="SKU" defaultValue={item?.sku ?? ""} maxLength={100} />
      <FormField
        id="category"
        label="Categoría"
        defaultValue={item?.category ?? ""}
        maxLength={100}
        list="stock-categories"
        autoComplete="off"
      />
      <datalist id="stock-categories">
        {categories.data?.map((category) => <option key={category} value={category} />)}
      </datalist>
      <div className="grid gap-1.5">
        <Label htmlFor="unit">Unidad</Label>
        <Select name="unit" defaultValue={item?.unit ?? "unit"}>
          <SelectTrigger id="unit" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {STOCK_UNIT_LABELS[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormField
        id="min_quantity"
        label="Stock mínimo"
        type="number"
        min={0}
        step="any"
        defaultValue={item?.min_quantity ?? "0"}
        required
        hint="Por debajo de este valor se marca como stock bajo."
      />
      <FormField id="unit_cost" label="Costo unitario ($)" type="number" min={0} step="0.01" defaultValue={item?.unit_cost ?? ""} />
      <FormField id="unit_price" label="Precio de venta ($)" type="number" min={0} step="0.01" defaultValue={item?.unit_price ?? ""} />
      <FormField id="supplier" label="Proveedor" defaultValue={item?.supplier ?? ""} maxLength={255} />
      <FormField id="location" label="Ubicación" defaultValue={item?.location ?? ""} maxLength={100} />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={item?.description ?? ""} rows={2} />
      </div>
    </>
  );
}
