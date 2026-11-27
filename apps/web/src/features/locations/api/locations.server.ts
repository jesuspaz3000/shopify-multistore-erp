import 'server-only';

import type { LocationResponse, Paginated, PaginationQuery } from '@erp/contracts';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/locations`;

/** Una página de bodegas (tabla de Configuración → Bodegas). */
export async function getLocationsPage(tenant: string, query: PaginationQuery): Promise<Paginated<LocationResponse>> {
  return (await getServerHttp()).get<Paginated<LocationResponse>>(base(tenant), toApiParams(query));
}
