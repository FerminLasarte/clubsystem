"use client";
// apps/web/app/(dashboard)/news/page.tsx
// Gestión de novedades del club — visibles para socios en la app móvil.

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Loader2,
  Newspaper,
  Plus,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { newsApi, type NewsCreate, type NewsOut } from "@/lib/api";
import { ActionButton } from "@/components/ui/action-button";
import { PageHeader }   from "@/components/ui/page-header";

// ── Tag catalogue ───────────────────────────────────────────────────────────

const TAG_OPTIONS = ["Aviso", "Clases", "Mantenimiento", "Torneo", "Promoción", "Otro"];

const TAG_COLORS: Record<string, string> = {
  Aviso:         "bg-blue-50   text-blue-700   border-blue-200",
  Clases:        "bg-green-50  text-green-700  border-green-200",
  Mantenimiento: "bg-orange-50 text-orange-700 border-orange-200",
  Torneo:        "bg-purple-50 text-purple-700 border-purple-200",
  Promoción:     "bg-pink-50   text-pink-700   border-pink-200",
  Otro:          "bg-gray-50   text-gray-600   border-gray-200",
};

// ── Expiry presets ──────────────────────────────────────────────────────────

type ExpiryPreset = "none" | "1w" | "2w" | "1m" | "custom";

const EXPIRY_PRESETS: { value: ExpiryPreset; label: string }[] = [
  { value: "none",   label: "Sin vencimiento" },
  { value: "1w",     label: "1 semana"        },
  { value: "2w",     label: "2 semanas"       },
  { value: "1m",     label: "1 mes"           },
  { value: "custom", label: "Fecha exacta"    },
];

function resolveExpiresAt(preset: ExpiryPreset, customDate: string): string | null {
  const now = new Date();
  if (preset === "none")   return null;
  if (preset === "1w")     { now.setDate(now.getDate() + 7);  return now.toISOString(); }
  if (preset === "2w")     { now.setDate(now.getDate() + 14); return now.toISOString(); }
  if (preset === "1m")     { now.setMonth(now.getMonth() + 1); return now.toISOString(); }
  if (preset === "custom" && customDate) {
    // End of the selected day in local time
    const d = new Date(`${customDate}T23:59:59`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "Sin vencimiento";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Tag pill ────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string | null }) {
  if (!tag) return null;
  const cls = TAG_COLORS[tag] ?? TAG_COLORS["Otro"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <Tag className="h-2.5 w-2.5" />
      {tag}
    </span>
  );
}

// ── News Card ───────────────────────────────────────────────────────────────

function NewsCard({
  item,
  onDelete,
  isDeleting,
}: {
  item:       NewsOut;
  onDelete:   () => void;
  isDeleting: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
      item.is_expired ? "border-gray-100 opacity-60" : "border-gray-100"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">

          {/* Meta row: tag + fecha + autor + vencimiento */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TagPill tag={item.tag} />
            <span className="text-[11px] text-gray-400">
              {formatCreated(item.created_at)}
            </span>
            {item.created_by_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <User className="h-3 w-3" />
                {item.created_by_name}
              </span>
            )}
            {item.expires_at && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                item.is_expired ? "text-red-500" : "text-amber-600"
              }`}>
                <Clock className="h-3 w-3" />
                {item.is_expired
                  ? `Vencida el ${formatExpiry(item.expires_at)}`
                  : `Vence el ${formatExpiry(item.expires_at)}`
                }
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">
            {item.title}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{item.body}</p>
        </div>

        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer"
          aria-label="Eliminar novedad"
        >
          {isDeleting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Trash2 className="h-4 w-4" />
          }
        </button>
      </div>
    </div>
  );
}

// ── Create Form ─────────────────────────────────────────────────────────────

function CreateNewsForm({
  onCreated,
  onCancel,
}: {
  onCreated: (item: NewsOut) => void;
  onCancel:  () => void;
}) {
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [tag,        setTag]        = useState("");
  const [preset,     setPreset]     = useState<ExpiryPreset>("none");
  const [customDate, setCustomDate] = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const isValid = title.trim().length > 0 && body.trim().length > 0 &&
    (preset !== "custom" || customDate !== "");

  // Minimum date for the custom picker: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload: NewsCreate = {
        title:      title.trim(),
        body:       body.trim(),
        tag:        tag || null,
        expires_at: resolveExpiresAt(preset, customDate),
      };
      const created = await newsApi.create(payload);
      onCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al publicar la novedad.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--color-brand)]/20 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-700">Nueva novedad</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">

        {/* Título */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Nuevos horarios de verano"
            maxLength={255}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-[var(--color-brand)] focus:bg-white focus:outline-none transition"
          />
        </div>

        {/* Cuerpo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Mensaje *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribí el cuerpo de la novedad…"
            rows={4}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-[var(--color-brand)] focus:bg-white focus:outline-none transition resize-none"
          />
        </div>

        {/* Tag */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Etiqueta</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? "" : t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  tag === t
                    ? (TAG_COLORS[t] ?? TAG_COLORS["Otro"]) + " ring-1 ring-offset-1 ring-current"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Vencimiento */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Vencimiento automático
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPreset(p.value); if (p.value !== "custom") setCustomDate(""); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  preset === p.value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 text-[var(--color-brand)] ring-1 ring-offset-1 ring-[var(--color-brand)]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date picker */}
          {preset === "custom" && (
            <div className="mt-3">
              <input
                type="date"
                value={customDate}
                min={minDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-[var(--color-brand)] focus:bg-white focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                La novedad se ocultará al final del día seleccionado.
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500">{error}</p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Publicar
        </button>
      </div>
    </form>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [news,       setNews]       = useState<NewsOut[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await newsApi.list();
      setNews(data);
    } catch {
      // silently ignore — list stays empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handleCreated = (item: NewsOut) => {
    setNews((prev) => [item, ...prev]);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await newsApi.remove(id);
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // noop — button re-enables
    } finally {
      setDeletingId(null);
    }
  };

  const active  = news.filter((n) => !n.is_expired);
  const expired = news.filter((n) => n.is_expired);

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <PageHeader
        title="Novedades"
        subtitle="Publicaciones visibles para tus socios en la app móvil."
      >
        {!showForm && (
          <ActionButton icon={Plus} onClick={() => setShowForm(true)}>
            Nueva novedad
          </ActionButton>
        )}
      </PageHeader>

      {/* ── Create Form ────────────────────────────────────── */}
      {showForm && (
        <CreateNewsForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── List ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <Newspaper className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">Sin novedades publicadas</p>
          <p className="mt-1 text-xs text-gray-400">
            Publicá avisos, clases o noticias para que tus socios las vean en la app.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Vigentes */}
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={deletingId === item.id}
                />
              ))}
            </div>
          )}

          {/* Vencidas */}
          {expired.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 px-1">
                Vencidas
              </p>
              {expired.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={deletingId === item.id}
                />
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
