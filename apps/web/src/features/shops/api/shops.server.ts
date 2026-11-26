import 'server-only';

import type { Paginated, PaginationQuery, ShopOptionResponse, ShopResponse } from '@erp/contracts';
import { cache } from 'react';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/shops`;

/** Todas las tiendas visibles (id, handle, nombre): selector de tienda, validación de URL, formularios. */
export const getShopOptions = cache(async (tenant: string): Promise<ShopOptionResponse[]> =>
  (await getServerHttp()).get<ShopOptionResponse[]>(`${base(tenant)}/options`),
);

/** Una página de tiendas (tabla de Configuración → Tiendas). */
export async function getShopsPage(tenant: string, query: PaginationQuery): Promise<Paginated<ShopResponse>> {
  return (await getServerHttp()).get<Paginated<ShopResponse>>(base(tenant), toApiParams(query));
}
