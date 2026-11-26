import 'server-only';

import type { ShopResponse } from '@erp/contracts';
import { cache } from 'react';
import { getServerHttp } from '@/lib/http/server';

/** Tiendas de la empresa visibles para el usuario. `cache`: una sola llamada por request. */
export const getTenantShops = cache(async (tenant: string): Promise<ShopResponse[]> => {
  const http = await getServerHttp();
  return http.get<ShopResponse[]>(`/tenants/${encodeURIComponent(tenant)}/shops`);
});
