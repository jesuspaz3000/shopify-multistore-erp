import type { AdjustInventoryInput, AdjustInventoryResponse } from '@erp/contracts';
import { http } from '@/lib/http';

export const adjustInventory = (tenant: string, input: AdjustInventoryInput) =>
  http.post<AdjustInventoryResponse>(`/tenants/${encodeURIComponent(tenant)}/inventory/adjustments`, input);
