import 'server-only';

import type { AdjustmentResponse, AdjustmentsQuery, InventoryQuery, InventoryRow, Paginated } from '@erp/contracts';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/inventory`;

/** Stock por variante en una bodega (o sumado en todas). */
export async function getInventoryPage(tenant: string, query: InventoryQuery): Promise<Paginated<InventoryRow>> {
  return (await getServerHttp()).get<Paginated<InventoryRow>>(base(tenant), toApiParams(query));
}

/** Historial de movimientos (kardex). */
export async function getAdjustmentsPage(tenant: string, query: AdjustmentsQuery): Promise<Paginated<AdjustmentResponse>> {
  return (await getServerHttp()).get<Paginated<AdjustmentResponse>>(`${base(tenant)}/adjustments`, toApiParams(query));
}
