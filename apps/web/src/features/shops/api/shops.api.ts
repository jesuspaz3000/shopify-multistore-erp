import type { ConnectShopifyData, ShopResponse } from '@erp/contracts';
import { http } from '@/lib/http';

// Mutaciones de tiendas (Client Components). Después de cada una, refrescar la ruta con router.refresh().
// Las tiendas no se crean a mano: llegan desde Shopify al conectarlas.
const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/shops`;

/** Conecta una tienda de Shopify: la crea con sus datos o, si ya estaba en la empresa, la reconecta. */
export const connectShopify = (tenant: string, input: ConnectShopifyData) => http.post<ShopResponse>(`${base(tenant)}/connect`, input);

export const refreshShopify = (tenant: string, shopId: number) => http.post<ShopResponse>(`${base(tenant)}/${shopId}/shopify/refresh`);

export const disconnectShopify = (tenant: string, shopId: number) => http.delete<ShopResponse>(`${base(tenant)}/${shopId}/shopify`);

export const deleteShop = (tenant: string, shopId: number) => http.delete<void>(`${base(tenant)}/${shopId}`);
