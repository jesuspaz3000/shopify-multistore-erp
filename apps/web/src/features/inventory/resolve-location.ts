import type { LocationOptionResponse } from '@erp/contracts';
import { firstParam, type SearchParams } from '@/lib/table-query';
import { ALL_LOCATIONS, LOCATION_PARAM } from './inventory-labels';

/**
 * Bodega de la URL (?location=12 | all). Si falta o no existe (o está inactiva): todas las bodegas,
 * la misma suma que muestra la lista de Productos (así los números coinciden). Para ajustar stock se
 * elige una bodega.
 */
export function resolveLocation(search: SearchParams, locations: LocationOptionResponse[]) {
  const raw = firstParam(search, LOCATION_PARAM);
  const found = locations.find((l) => String(l.id) === raw);
  const value = found ? String(found.id) : ALL_LOCATIONS;
  return { value, locationId: value === ALL_LOCATIONS ? undefined : Number(value) };
}
