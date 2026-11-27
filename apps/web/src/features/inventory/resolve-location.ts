import type { LocationOptionResponse } from '@erp/contracts';
import { firstParam, type SearchParams } from '@/lib/table-query';
import { ALL_LOCATIONS, LOCATION_PARAM } from './inventory-labels';

/**
 * Bodega de la URL (?location=12 | all). Si falta o no existe (o está inactiva), se usa el valor por
 * defecto: la primera bodega (stock editable) o todas (kardex).
 */
export function resolveLocation(search: SearchParams, locations: LocationOptionResponse[], fallback: 'first' | 'all') {
  const raw = firstParam(search, LOCATION_PARAM);
  const found = locations.find((l) => String(l.id) === raw);
  const value =
    raw === ALL_LOCATIONS ? ALL_LOCATIONS : found ? String(found.id) : fallback === 'first' && locations[0] ? String(locations[0].id) : ALL_LOCATIONS;
  return { value, locationId: value === ALL_LOCATIONS ? undefined : Number(value) };
}
