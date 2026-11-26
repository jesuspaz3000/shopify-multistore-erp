import type { CreateShopData, ShopResponse, UpdateShopData } from '@erp/contracts';
import { http } from '@/lib/http';

// Mutaciones de tiendas (Client Components). Después de cada una, refrescar la ruta con router.refresh().
const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/shops`;

export const createShop = (tenant: string, input: CreateShopData) => http.post<ShopResponse>(base(tenant), input);

export const updateShop = (tenant: string, shopId: number, input: UpdateShopData) =>
  http.patch<ShopResponse>(`${base(tenant)}/${shopId}`, input);

export const deleteShop = (tenant: string, shopId: number) => http.delete<void>(`${base(tenant)}/${shopId}`);
