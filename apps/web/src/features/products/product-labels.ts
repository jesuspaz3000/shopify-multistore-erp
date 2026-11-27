import type { ProductStatus, WeightUnit } from '@erp/contracts';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, { label: string; color: 'success' | 'default' | 'warning' }> = {
  ACTIVE: { label: 'Activo', color: 'success' },
  DRAFT: { label: 'Borrador', color: 'default' },
  ARCHIVED: { label: 'Archivado', color: 'warning' },
};

export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((value) => ({
  value,
  label: PRODUCT_STATUS_LABELS[value].label,
}));

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  OUNCES: 'oz',
  POUNDS: 'lb',
};

/** "USD 20" o "USD 20 – 22.90". */
export function priceRange(min: string | null, max: string | null, currency: string): string {
  if (!min) return '—';
  return min === max ? `${currency} ${min}` : `${currency} ${min} – ${max}`;
}
