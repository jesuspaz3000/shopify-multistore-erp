import type { CreateLocationData, LocationResponse, SetLocationShopsData, UpdateLocationData } from '@erp/contracts';
import { http } from '@/lib/http';

// Mutaciones de bodegas (Client Components). Después de cada una, refrescar la ruta con router.refresh().
const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/locations`;

export const createLocation = (tenant: string, input: CreateLocationData) => http.post<LocationResponse>(base(tenant), input);

export const updateLocation = (tenant: string, locationId: number, input: UpdateLocationData) =>
  http.patch<LocationResponse>(`${base(tenant)}/${locationId}`, input);

export const setLocationShops = (tenant: string, locationId: number, input: SetLocationShopsData) =>
  http.put<LocationResponse>(`${base(tenant)}/${locationId}/shops`, input);

export const deleteLocation = (tenant: string, locationId: number) => http.delete<void>(`${base(tenant)}/${locationId}`);
