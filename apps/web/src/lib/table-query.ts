import { type PaginationQuery, paginationQuerySchema } from '@erp/contracts';

/**
 * Estado de una tabla en la URL: ?page=2&pageSize=20&q=lima (+ filtros propios, ej. &status=ACTIVE).
 * Con varias tablas en una página se usa un prefijo: ?invPage=2&invQ=ana (tabla "inv").
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export const paramName = (prefix: string, key: string) => (prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key);

/** Primer valor de un parámetro de la URL (?a=1&a=2 -> "1"). */
export function firstParam(searchParams: SearchParams, name: string): string | undefined {
  const value = searchParams[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Lee page/pageSize/q (con prefijo) y los valida: valores inválidos vuelven a los por defecto. */
export function readTableQuery(searchParams: SearchParams, prefix = ''): PaginationQuery {
  const first = (key: string) => firstParam(searchParams, paramName(prefix, key));
  return paginationQuerySchema.parse({ page: first('page'), pageSize: first('pageSize'), q: first('q') });
}

/** Parámetros para la API (siempre sin prefijo); los filtros vacíos no se envían. */
export const toApiParams = (query: PaginationQuery & Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
