"use client";
// apps/web/app/(dashboard)/stock/page.tsx

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle, CheckCircle, Package, Search, DollarSign } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const UNIT_LABELS: Record<string, string> = {
  unit: "unidad", box: "caja", kg: "kg", liter: "litro", pack: "pack",
};

interface StockItem {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  unit_cost: number | null;
  is_low_stock: boolean;
}

interface StockStats {
  total_items: number;
  low_stock_count: number;
  total_value: number;
}

function RowSkeleton() {
  return (
    <tr>
      {[60,180,100,70,60,60,90,70].map((w,i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function StockPage() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterLow, setFilterLow] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterLow === true) params.set("low_stock", "true");
    if (filterLow === false) params.set("low_stock", "false");

    try {
      const [itemsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/v1/stock?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/v1/stock/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!itemsRes.ok || !statsRes.ok) throw new Error("Error al cargar inventario");
      setItems(await itemsRes.json());
      setStats(await statsRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterLow]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventario</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {stats ? `${stats.total_items} producto${stats.total_items !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
        <button 
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Plus className="h-4 w-4" />
          Agregar ítem
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Productos</span>
            <Package className="h-4 w-4 text-gray-300" />
          </div>
          {stats
            ? <p className="mt-3 text-2xl font-semibold text-gray-900">{stats.total_items}</p>
            : <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-100" />}
        </div>

        <div className={`rounded-xl border p-5 ${stats?.low_stock_count ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Stock bajo</span>
            <AlertCircle className={`h-4 w-4 ${stats?.low_stock_count ? "text-orange-500" : "text-gray-300"}`} />
          </div>
          {stats
            ? <p className={`mt-3 text-2xl font-semibold ${stats.low_stock_count ? "text-orange-700" : "text-gray-900"}`}>{stats.low_stock_count}</p>
            : <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-100" />}
          {stats && <p className="mt-1 text-xs text-gray-400">requieren reposición</p>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Valor total</span>
            <DollarSign className="h-4 w-4 text-gray-300" />
          </div>
          {stats
            ? <p className="mt-3 text-2xl font-semibold text-gray-900 tabular">${Math.round(stats.total_value).toLocaleString("es-AR")}</p>
            : <div className="mt-3 h-8 w-28 animate-pulse rounded bg-gray-100" />}
        </div>
      </div>

      {/* Alerta stock bajo */}
      {stats && stats.low_stock_count > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {stats.low_stock_count} producto{stats.low_stock_count > 1 ? "s tienen" : " tiene"} stock bajo o agotado
            </p>
            <p className="mt-1 text-xs text-orange-600">
              {items.filter(i => i.is_low_stock).map(i => i.name).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o categoría…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition"
          />
        </div>
        <button
          onClick={() => setFilterLow(filterLow === true ? null : true)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
            filterLow === true
              ? "border-orange-300 bg-orange-50 text-orange-700"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Solo stock bajo
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {["SKU", "Producto", "Categoría", "Unidad", "Stock", "Mínimo", "Costo unit.", "Estado"].map((h, i) => (
                <th
                  key={h}
                  className={`px-5 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                    i >= 4 && i <= 6 ? "text-right" : i === 7 ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
              : items.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-gray-400">
                    {search ? `Sin resultados para "${search}"` : "No hay productos en inventario"}
                  </td>
                </tr>
              )
              : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-gray-400">
                    {item.sku ?? <span className="text-gray-200">—</span>}
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-900 max-w-[180px]">
                    <span className="line-clamp-1">{item.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    {item.category
                      ? <span className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">{item.category}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 capitalize text-gray-500">
                    {UNIT_LABELS[item.unit] ?? item.unit}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`tabular font-semibold ${item.is_low_stock ? "text-orange-600" : "text-gray-900"}`}>
                      {Number(item.quantity).toLocaleString("es-AR")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular text-gray-400">
                    {Number(item.min_quantity).toLocaleString("es-AR")}
                  </td>
                  <td className="px-5 py-4 text-right tabular text-gray-600">
                    {item.unit_cost != null
                      ? `$${Math.round(item.unit_cost).toLocaleString("es-AR")}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.is_low_stock ? (
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
              ))
            }
          </tbody>
        </table>

        {items.length > 0 && (
          <div className="border-t border-gray-50 px-6 py-3">
            <p className="text-xs text-gray-400">
              {items.length} producto{items.length !== 1 ? "s" : ""}
              {stats && ` · Valor total: $${Math.round(stats.total_value).toLocaleString("es-AR")} ARS`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
