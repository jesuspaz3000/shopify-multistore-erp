import { type PaginationQuery, paginationQuerySchema } from '@erp/contracts';

/**
 * Estado de una tabla en la URL: ?page=2&pageSize=20&q=lima.
 * Con varias tablas en una página se usa un prefijo: ?invPage=2&invQ=ana (tabla "inv").
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export const paramName = (prefix: string, key: 'page' | 'pageSize' | 'q') =>
  prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;

/** Lee page/pageSize/q (con prefijo) y los valida: valores inválidos vuelven a los por defecto. */
export function readTableQuery(searchParams: SearchParams, prefix = ''): PaginationQuery {
  const first = (key: 'page' | 'pageSize' | 'q') => {
    const value = searchParams[paramName(prefix, key)];
    return Array.isArray(value) ? value[0] : value;
  };
  return paginationQuerySchema.parse({ page: first('page'), pageSize: first('pageSize'), q: first('q') });
}

/** Parámetros para la API (siempre sin prefijo). */
export const toApiParams = (query: PaginationQuery) => ({ page: query.page, pageSize: query.pageSize, ...(query.q ? { q: query.q } : {}) });
