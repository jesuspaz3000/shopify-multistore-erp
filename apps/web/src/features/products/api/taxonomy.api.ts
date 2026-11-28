import type { TaxonomyCategoryResponse } from '@erp/contracts';
import { http } from '@/lib/http';

// Categorías de producto (taxonomía estándar de Shopify). Cambian solo con una versión nueva de la
// taxonomía: se guardan en memoria mientras la página esté abierta.
const cache = new Map<string, Promise<TaxonomyCategoryResponse[]>>();

/** Con `q` busca; si no, las hijas de `parentId` (o las categorías raíz). */
export function listCategories(tenant: string, params: { q?: string; parentId?: string }): Promise<TaxonomyCategoryResponse[]> {
  const key = `${tenant}|${params.q ?? ''}|${params.parentId ?? ''}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = http.get<TaxonomyCategoryResponse[]>(`/tenants/${encodeURIComponent(tenant)}/taxonomy/categories`, params);
    pending.catch(() => cache.delete(key)); // un error no queda guardado
    cache.set(key, pending);
  }
  return pending;
}
