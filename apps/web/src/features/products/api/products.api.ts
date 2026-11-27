import type { ProductInput, ProductResponse } from '@erp/contracts';
import { http } from '@/lib/http';

// Mutaciones del catálogo (Client Components).
const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/products`;

export const createProduct = (tenant: string, input: ProductInput) => http.post<ProductResponse>(base(tenant), input);

export const updateProduct = (tenant: string, productId: number, input: ProductInput) =>
  http.put<ProductResponse>(`${base(tenant)}/${productId}`, input);

export const deleteProduct = (tenant: string, productId: number) => http.delete<void>(`${base(tenant)}/${productId}`);
