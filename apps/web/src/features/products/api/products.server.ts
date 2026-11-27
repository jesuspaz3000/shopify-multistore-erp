import 'server-only';

import type { Paginated, ProductFacetsResponse, ProductListItem, ProductResponse, ProductsQuery } from '@erp/contracts';
import { ApiError } from '@/lib/http/errors';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/products`;

/** Una página del catálogo (?page, ?pageSize, ?q, ?status). */
export async function getProductsPage(tenant: string, query: ProductsQuery): Promise<Paginated<ProductListItem>> {
  return (await getServerHttp()).get<Paginated<ProductListItem>>(base(tenant), toApiParams(query));
}

/** Producto con opciones y variantes; null si no existe (o es de otra empresa). */
export async function getProduct(tenant: string, productId: string): Promise<ProductResponse | null> {
  if (!/^\d+$/.test(productId)) return null;
  try {
    return await (await getServerHttp()).get<ProductResponse>(`${base(tenant)}/${productId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Tipos, proveedores y etiquetas ya usados (sugerencias del formulario). */
export async function getProductFacets(tenant: string): Promise<ProductFacetsResponse> {
  return (await getServerHttp()).get<ProductFacetsResponse>(`${base(tenant)}/facets`);
}
