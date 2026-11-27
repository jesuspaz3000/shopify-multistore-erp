import 'server-only';

import type { LocationOptionResponse, LocationResponse, Paginated, PaginationQuery } from '@erp/contracts';
import { cache } from 'react';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/locations`;

/** Bodegas activas (id, código, nombre) para selectores. */
export const getLocationOptions = cache(async (tenant: string): Promise<LocationOptionResponse[]> =>
  (await getServerHttp()).get<LocationOptionResponse[]>(`${base(tenant)}/options`),
);

/** Una página de bodegas (tabla de Configuración → Bodegas). */
export async function getLocationsPage(tenant: string, query: PaginationQuery): Promise<Paginated<LocationResponse>> {
  return (await getServerHttp()).get<Paginated<LocationResponse>>(base(tenant), toApiParams(query));
}
