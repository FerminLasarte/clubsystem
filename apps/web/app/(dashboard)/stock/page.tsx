"use client";
// apps/web/app/(dashboard)/stock/page.tsx
//
// Gestión de inventario del club.
//
// Datos:   stockApi (GET /stock, GET /stock/stats, POST, PUT, DELETE, /adjust)
// Sesión:  useClubSession() → activeClub
// Tipos:   StockItemOut, StockItemCreate, StockStats (de lib/api.ts)
//
// Flujos:
//  · Crear ítem    → botón "Agregar ítem" → modal → POST → append local
//  · Editar ítem   → botón ✏ → modal pre-relleno → PUT → actualiza fila
//  · +1 / -1       → draft local (sin API) → botón Guardar → POST /adjust → commit atómico
//  · Eliminar      → botón 🗑 → confirmación inline → DELETE → elimina de lista
//  · Buscar/filtrar → debounce 350 ms → re-fetch

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  DollarSign,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useClubSession } from "@/contexts/ClubSessionContext";
import {
  stockApi,
  type StockItemCreate,
  type StockItemOut,
  type StockItemUpdate,
  type StockStats,
} from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: "unit",  label: "Unidad" },
  { value: "box",   label: "Caja"   },
  { value: "kg",    label: "Kg"     },
  { value: "liter", label: "Litro"  },
  { value: "pack",  label: "Pack"   },
] as const;

const UNIT_LABELS: Record<string, string> = {
  unit: "unidad", box: "caja", kg: "kg", liter: "litro", pack: "pack",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  name:         string;
  sku:          string;
  category:     string;
  unit:         string;
  quantity:     string;
  min_quantity: string;
  unit_cost:    string;
  supplier:     string;
}

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; item: StockItemOut }
  | null;

type ToastState = { message: string; type: "success" | "error" } | null;

const EMPTY_FORM: FormState = {
  name: "", sku: "", category: "", unit: "unit",
  quantity: "0", min_quantity: "0", unit_cost: "", supplier: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr>
      {[60, 180, 100, 70, 60, 60, 90, 70, 96].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function StatCard({
  label, icon: Icon, value, sub, warn = false,
}: {
  label: string;
  icon: React.ElementType;
  value: React.ReactNode;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${warn ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={`h-4 w-4 ${warn ? "text-orange-400" : "text-gray-300"}`} />
      </div>
      <div className={`mt-3 text-2xl font-semibold tabular-nums ${warn ? "text-orange-700" : "text-gray-900"}`}>
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Modal crear / editar ──────────────────────────────────────────────────────

function StockFormModal({
  modal,
  onClose,
  onSave,
}: {
  modal:   NonNullable<ModalState>;
  onClose: () => void;
  onSave:  (payload: StockItemCreate | StockItemUpdate, id?: string) => Promise<void>;
}) {
  const isEdit = modal.mode === "edit";
  const editItem = isEdit ? (modal as { mode: "edit"; item: StockItemOut }).item : null;

  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editItem) {
      setForm({
        name:         editItem.name,
        sku:          editItem.sku          ?? "",
        category:     editItem.category     ?? "",
        unit:         editItem.unit,
        quantity:     String(editItem.quantity),
        min_quantity: String(editItem.min_quantity),
        unit_cost:    editItem.unit_cost != null ? String(editItem.unit_cost) : "",
        supplier:     editItem.supplier ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setFormError(null);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [modal.mode]);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload: StockItemCreate = {
      name:         form.name.trim(),
      sku:          form.sku.trim()      || null,
      category:     form.category.trim() || null,
      unit:         form.unit,
      quantity:     parseFloat(form.quantity)     || 0,
      min_quantity: parseFloat(form.min_quantity) || 0,
      unit_cost:    form.unit_cost ? parseFloat(form.unit_cost) : null,
      supplier:     form.supplier.trim() || null,
    };
    setSaving(true);
    try {
      await onSave(payload, editItem?.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm " +
    "text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {isEdit ? "Editar ítem" : "Agregar ítem"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstRef}
              required
              minLength={2}
              value={form.name}
              onChange={set("name")}
              placeholder="Ej: Pelotas de pádel"
              className={inputCls}
            />
          </div>

          {/* SKU + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">SKU</label>
              <input value={form.sku} onChange={set("sku")} placeholder="PB-001" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Categoría</label>
              <input value={form.category} onChange={set("category")} placeholder="Equipamiento" className={inputCls} />
            </div>
          </div>

          {/* Unidad + Costo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Unidad</label>
              <select value={form.unit} onChange={set("unit")} className={inputCls}>
                {UNIT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Costo unitario ($)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.unit_cost} onChange={set("unit_cost")}
                placeholder="0.00" className={inputCls}
              />
            </div>
          </div>

          {/* Cantidad + Mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Stock actual</label>
              <input
                type="number" min="0" step="0.01"
                value={form.quantity} onChange={set("quantity")} className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Stock mínimo</label>
              <input
                type="number" min="0" step="0.01"
                value={form.min_quantity} onChange={set("min_quantity")} className={inputCls}
              />
            </div>
          </div>

          {/* Proveedor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Proveedor</label>
            <input
              value={form.supplier} onChange={set("supplier")}
              placeholder="Nombre del proveedor" className={inputCls}
            />
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEdit ? "Guardar cambios" : "Agregar ítem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const { activeClub } = useClubSession();

  const [items,   setItems]   = useState<StockItemOut[]>([]);
  const [stats,   setStats]   = useState<StockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch]  = useState("");
  const [filterLow,       setFilterLow]       = useState<boolean | null>(null);

  // UI state
  const [modal,           setModal]           = useState<ModalState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [movingId,        setMovingId]        = useState<string | null>(null);
  const [toast,           setToast]           = useState<ToastState>(null);

  /**
   * Cantidades en borrador: las ediciones de +/- se guardan aquí antes de
   * confirmar con el botón "Guardar". Clave = item.id, valor = cantidad objetivo.
   */
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});

  // ── Debounce ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!activeClub) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsData, statsData] = await Promise.all([
        stockApi.list({
          search:   debouncedSearch || undefined,
          lowStock: filterLow ?? undefined,
        }),
        stockApi.stats(),
      ]);
      setItems(itemsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }, [activeClub?.clubId, debouncedSearch, filterLow]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Crear o editar desde el modal. Actualiza estado local sin re-fetch. */
  const handleSave = async (
    payload: StockItemCreate | StockItemUpdate,
    editId?: string,
  ) => {
    if (editId) {
      const updated = await stockApi.update(editId, payload);
      setItems((prev) => prev.map((i) => (i.id === editId ? updated : i)));
      setStats((prev) =>
        prev ? { ...prev, low_stock_count: prev.low_stock_count + (updated.is_low_stock ? 1 : 0) } : prev
      );
      showToast(`"${updated.name}" actualizado`);
    } else {
      const created = await stockApi.create(payload as StockItemCreate);
      setItems((prev) => [...prev, created]);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_items:     prev.total_items + 1,
              low_stock_count: created.is_low_stock ? prev.low_stock_count + 1 : prev.low_stock_count,
            }
          : prev
      );
      showToast(`"${created.name}" agregado al inventario`);
    }
  };

  /**
   * Paso del botón +/- según la unidad del ítem.
   * Discretas (box, unit, pack) → salto de 1 entero.
   * Continuas (kg, liter)        → salto de 0.5, 1 decimal.
   */
  const getStep = (unit: string) => (unit === "kg" || unit === "liter" ? 0.5 : 1);

  /**
   * Modifica la cantidad en el borrador local — SIN llamar a la API.
   * Usa el actualizador funcional de setState para evitar dependencia del snapshot.
   */
  const handleDraftChange = useCallback(
    (item: StockItemOut, direction: 1 | -1) => {
      const step = getStep(item.unit);
      setDraftQuantities((prev) => {
        const current = prev[item.id] ?? item.quantity;
        let next = current + direction * step;
        // Forzar entero en unidades discretas; 1 decimal en continuas
        next =
          item.unit === "kg" || item.unit === "liter"
            ? Math.round(next * 10) / 10
            : Math.round(next);
        if (next < 0) return prev;          // no permitir negativo
        return { ...prev, [item.id]: next };
      });
    },
    [], // sin deps: sólo usa actualizador funcional + arg item
  );

  /**
   * Guarda el borrador: calcula la diferencia exacta y llama a POST /adjust.
   * Si la diferencia es 0, simplemente descarta el borrador.
   */
  const handleSaveDraft = useCallback(
    async (item: StockItemOut) => {
      const draftQty = draftQuantities[item.id];
      if (draftQty === undefined) return;

      const diff = draftQty - item.quantity;
      if (diff === 0) {
        setDraftQuantities((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
        return;
      }

      setMovingId(item.id);
      try {
        const result = await stockApi.adjust(item.id, {
          quantity_change: Math.abs(diff),
          movement_type:   diff > 0 ? "IN" : "OUT",
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  quantity:     result.quantity_after,
                  is_low_stock: result.quantity_after <= i.min_quantity,
                }
              : i,
          ),
        );
        setDraftQuantities((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
        showToast(`Stock de "${item.name}" actualizado`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Error al guardar", "error");
      } finally {
        setMovingId(null);
      }
    },
    [draftQuantities, showToast],
  );

  /** Descarta el borrador sin tocar la API. */
  const handleCancelDraft = useCallback((itemId: string) => {
    setDraftQuantities((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
  }, []);

  /** Eliminar con confirmación inline. */
  const handleDelete = async (item: StockItemOut) => {
    try {
      await stockApi.remove(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_items:     prev.total_items - 1,
              low_stock_count: item.is_low_stock ? prev.low_stock_count - 1 : prev.low_stock_count,
            }
          : prev
      );
      showToast(`"${item.name}" eliminado`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ── Empty: sin club ───────────────────────────────────────────────────────
  if (!loading && !activeClub) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-gray-900">Inventario</h1>
        <p className="mt-8 text-center text-sm text-gray-400">No hay ningún club activo.</p>
      </div>
    );
  }

  const lowStockNames = items.filter((i) => i.is_low_stock).map((i) => i.name);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventario</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {stats ? `${stats.total_items} producto${stats.total_items !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand, #111827)" }}
        >
          <Plus className="h-4 w-4" />
          Agregar ítem
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Productos" icon={Package}
          value={stats ? stats.total_items : <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />} />
        <StatCard label="Stock bajo" icon={AlertCircle} warn={!!stats?.low_stock_count}
          value={stats ? stats.low_stock_count : <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />}
          sub={stats ? "requieren reposición" : undefined} />
        <StatCard label="Valor total" icon={DollarSign}
          value={stats
            ? `$\u00A0${Math.round(stats.total_value).toLocaleString("es-AR")}`
            : <div className="h-8 w-28 animate-pulse rounded bg-gray-100" />
          } />
      </div>

      {/* Alerta bajo stock */}
      {stats && stats.low_stock_count > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {stats.low_stock_count} producto{stats.low_stock_count > 1 ? "s tienen" : " tiene"} stock bajo
            </p>
            <p className="mt-0.5 text-xs text-orange-600 line-clamp-1">{lowStockNames.join(" · ")}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition"
          />
        </div>
        <button
          onClick={() => setFilterLow(filterLow === true ? null : true)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition cursor-pointer ${
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
              {["SKU", "Producto", "Categoría", "Unidad", "Stock", "Mínimo", "Costo", "Estado", "Acciones"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3.5 text-xs font-medium uppercase tracking-wide text-gray-400 ${
                      i >= 4 && i <= 6 ? "text-right"
                      : i === 7 ? "text-center"
                      : i === 8 ? "text-right"
                      : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
              : items.length === 0
              ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm text-gray-400">
                    {search ? `Sin resultados para "${search}"` : "No hay productos. ¡Agregá el primero!"}
                  </td>
                </tr>
              )
              : items.map((item) => {
                  const isConfirming = confirmDeleteId === item.id;
                  const isMoving     = movingId === item.id;
                  const draftQty     = draftQuantities[item.id];
                  const hasDraft     = draftQty !== undefined && draftQty !== item.quantity;
                  const displayQty   = hasDraft ? draftQty : item.quantity;
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isConfirming ? "bg-red-50"
                        : hasDraft   ? "bg-amber-50/60"
                        : "hover:bg-gray-50"
                      }`}
                    >
                      {/* SKU */}
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-400">
                        {item.sku ?? <span className="text-gray-200">—</span>}
                      </td>
                      {/* Nombre */}
                      <td className="px-4 py-3.5 font-medium text-gray-900 max-w-[160px]">
                        <span className="line-clamp-1">{item.name}</span>
                      </td>
                      {/* Categoría */}
                      <td className="px-4 py-3.5">
                        {item.category
                          ? <span className="rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{item.category}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                      {/* Unidad */}
                      <td className="px-4 py-3.5 text-xs capitalize text-gray-500">
                        {UNIT_LABELS[item.unit] ?? item.unit}
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-3.5 text-right">
                        {hasDraft ? (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            <span className="tabular-nums font-semibold text-amber-600">
                              {Number(displayQty).toLocaleString("es-AR")}
                            </span>
                            <span className="tabular-nums text-[10px] text-gray-300 line-through">
                              {Number(item.quantity).toLocaleString("es-AR")}
                            </span>
                          </span>
                        ) : (
                          <span className={`tabular-nums font-semibold ${item.is_low_stock ? "text-orange-600" : "text-gray-900"}`}>
                            {Number(item.quantity).toLocaleString("es-AR")}
                          </span>
                        )}
                      </td>
                      {/* Mínimo */}
                      <td className="px-4 py-3.5 text-right tabular-nums text-xs text-gray-400">
                        {Number(item.min_quantity).toLocaleString("es-AR")}
                      </td>
                      {/* Costo */}
                      <td className="px-4 py-3.5 text-right tabular-nums text-xs text-gray-600">
                        {item.unit_cost != null
                          ? `$${Math.round(item.unit_cost).toLocaleString("es-AR")}`
                          : <span className="text-gray-200">—</span>}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                            <AlertCircle className="h-2.5 w-2.5" /> Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400">
                            <CheckCircle className="h-2.5 w-2.5 text-gray-300" /> OK
                          </span>
                        )}
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3.5">
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-red-600">¿Eliminar?</span>
                            <button
                              onClick={() => handleDelete(item)}
                              className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition cursor-pointer"
                            >Sí</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                            >No</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {/* − paso */}
                            <button
                              onClick={() => handleDraftChange(item, -1)}
                              disabled={displayQty <= 0 || isMoving}
                              title={`Restar ${getStep(item.unit)} ${item.unit}`}
                              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 disabled:opacity-30 transition cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            {/* + paso */}
                            <button
                              onClick={() => handleDraftChange(item, 1)}
                              disabled={isMoving}
                              title={`Sumar ${getStep(item.unit)} ${item.unit}`}
                              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 disabled:opacity-30 transition cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>

                            {hasDraft ? (
                              <>
                                {/* Guardar borrador */}
                                <button
                                  onClick={() => handleSaveDraft(item)}
                                  disabled={isMoving}
                                  title="Guardar cambios de stock"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition cursor-pointer"
                                >
                                  {isMoving
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Check className="h-3 w-3" />}
                                </button>
                                {/* Cancelar borrador */}
                                <button
                                  onClick={() => handleCancelDraft(item.id)}
                                  disabled={isMoving}
                                  title="Descartar cambios"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 disabled:opacity-40 transition cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Editar */}
                                <button
                                  onClick={() => setModal({ mode: "edit", item })}
                                  title="Editar ítem"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 transition cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {/* Eliminar */}
                                <button
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  title="Eliminar ítem"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 transition cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {items.length > 0 && (
          <div className="border-t border-gray-50 px-6 py-3">
            <p className="text-xs text-gray-400">
              {items.length} producto{items.length !== 1 ? "s" : ""}
              {stats ? ` · Valor total: $\u00A0${Math.round(stats.total_value).toLocaleString("es-AR")} ARS` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <StockFormModal
          modal={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Toast notificación */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="h-4 w-4 text-emerald-500" />
            : <AlertCircle className="h-4 w-4 text-red-500" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
