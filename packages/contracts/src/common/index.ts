import { z } from 'zod';

// Contratos comunes a todos los dominios.

// Cuerpo de error que devuelve la API (formato estándar de NestJS).
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
};

// ---------- Paginación (query params: ?page=1&pageSize=20&q=texto) ----------

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** Búsqueda de texto libre (opcional). */
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type PaginationQuery = z.output<typeof paginationQuerySchema>;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Arma la respuesta paginada a partir de los items de la página y el total. */
export function paginated<T>(items: T[], total: number, query: Pick<PaginationQuery, 'page' | 'pageSize'>): Paginated<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Escapa % y _ para usar un texto del usuario dentro de un ILIKE. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
