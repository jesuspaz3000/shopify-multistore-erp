'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { paramName } from '@/lib/table-query';

/** page/pageSize/q y cualquier filtro propio de la tabla (ej. status). */
type TableParams = Partial<{ page: number; pageSize: number; q: string }> & Record<string, string | number | undefined>;

/**
 * Actualiza los parámetros de una tabla en la URL (sin tocar los de otras tablas).
 * - 'push' (cambiar de página/tamaño/filtro): "Atrás" vuelve al estado anterior de la tabla.
 * - 'replace' (escribir en el buscador): no llena el historial con cada letra.
 * La navegación va en una transición: la tabla actual sigue visible mientras llega la nueva.
 */
export function useTableParams(prefix = '') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = (changes: TableParams, history: 'push' | 'replace' = 'push') => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      const name = paramName(prefix, key);
      // Los valores por defecto no ensucian la URL.
      const isDefault = value === undefined || value === '' || (key === 'page' && value === 1);
      if (isDefault) params.delete(name);
      else params.set(name, String(value));
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    startTransition(() => (history === 'push' ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })));
  };

  return { setParams, isPending, current: (key: string) => searchParams.get(paramName(prefix, key)) };
}
