"use client";
// apps/web/components/stock/StockTable.tsx

import type { StockItem } from "@ClubSystem/types";
import { AlertCircle, CheckCircle } from "lucide-react";

interface StockTableProps {
  items: StockItem[];
  onRowClick?: (item: StockItem) => void;
  loading?: boolean;
}

const UNIT_LABELS: Record<string, string> = {
  unit:  "unidad",
  box:   "caja",
  kg:    "kg",
  liter: "litro",
  pack:  "pack",
};

export function StockTable({ items, onRowClick, loading = false }: StockTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-6 py-4 border-b border-gray-50 last:border-0">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-400">Sin productos en inventario</p>
        <p className="mt-1 text-xs text-gray-300">Agregá ítems para comenzar a gestionar el stock.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {["SKU", "Producto", "Categoría", "Unidad", "Stock", "Mínimo", "Costo unit.", "Estado"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`px-5 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                    i >= 4 && i <= 6 ? "text-right" : i === 7 ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item) => {
            const isLow = item.quantity <= item.minQuantity;
            return (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
                }`}
              >
                <td className="px-5 py-4 font-mono text-xs text-gray-400">
                  {item.sku ?? <span className="text-gray-200">—</span>}
                </td>
                <td className="px-5 py-4 font-medium text-gray-900 max-w-xs">
                  <span className="line-clamp-1">{item.name}</span>
                </td>
                <td className="px-5 py-4">
                  {item.category ? (
                    <span className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                      {item.category}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-4 capitalize text-gray-500">
                  {UNIT_LABELS[item.unit] ?? item.unit}
                </td>
                <td className="px-5 py-4 text-right">
                  <span
                    className={`tabular font-semibold ${
                      isLow ? "text-orange-600" : "text-gray-900"
                    }`}
                  >
                    {Number(item.quantity).toLocaleString("es-AR")}
                  </span>
                </td>
                <td className="px-5 py-4 text-right tabular text-gray-400">
                  {Number(item.minQuantity).toLocaleString("es-AR")}
                </td>
                <td className="px-5 py-4 text-right tabular text-gray-600">
                  {item.unitCost != null
                    ? `$${Number(item.unitCost).toLocaleString("es-AR")}`
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-4 text-center">
                  {isLow ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600">
                      <AlertCircle className="h-3 w-3" />
                      Stock bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                      <CheckCircle className="h-3 w-3 text-gray-300" />
                      OK
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
