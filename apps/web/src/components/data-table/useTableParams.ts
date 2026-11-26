'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { paramName } from '@/lib/table-query';

type TableParams = Partial<{ page: number; pageSize: number; q: string }>;

/**
 * Actualiza page/pageSize/q de una tabla en la URL (sin tocar los de otras tablas).
 * - 'push' (cambiar de página/tamaño): "Atrás" vuelve a la página anterior de la tabla.
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
    for (const [key, value] of Object.entries(changes) as [keyof TableParams, string | number | undefined][]) {
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

  return { setParams, isPending, current: (key: 'page' | 'pageSize' | 'q') => searchParams.get(paramName(prefix, key)) };
}
