"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** null, undefined o "" borran el parámetro. */
export type UrlParamValue = string | number | null | undefined;

interface ReadableParams {
  get: (key: string) => string | null;
}

/**
 * Filtros, pestaña y paginación en la URL: sobreviven al recargar y se pueden compartir.
 * `setParams` aplica un parche (las demás claves se conservan) y reemplaza la entrada del historial.
 * Quien lo use tiene que estar dentro de un <Suspense> (requisito de useSearchParams).
 */
export function useUrlParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback(
    (updates: Record<string, UrlParamValue>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  return [params, setParams] as const;
}

/** Número de página (>= 1) leído de la URL. */
export function pageParam(params: ReadableParams, key = "page"): number {
  const page = Number(params.get(key));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** true si `value` (p. ej. un parámetro de la URL) es una de las opciones permitidas. */
export function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && (options as readonly string[]).includes(value);
}
