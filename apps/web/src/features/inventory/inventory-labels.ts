import type { AdjustmentReason } from '@erp/contracts';

export const REASON_LABELS: Record<AdjustmentReason, string> = {
  initial: 'Stock inicial',
  received: 'Recepción de mercadería',
  correction: 'Corrección',
  cycle_count_available: 'Conteo de inventario',
  damaged: 'Dañado',
  shrinkage: 'Merma o pérdida',
  restock: 'Devolución a stock',
  other: 'Otro',
};

/** Parámetro de la URL para la bodega: ?location=12 o ?location=all. */
export const LOCATION_PARAM = 'location';
export const ALL_LOCATIONS = 'all';

/**
 * Lo que se escribe en la celda "Disponible":
 * "+5" / "-3" = sumar o restar · "12" = nueva cantidad · otra cosa = inválido.
 */
export function parseAvailableInput(text: string): { delta: number } | { quantity: number } | null {
  const value = text.trim();
  if (/^[+-]\d+$/.test(value)) {
    const delta = Number(value);
    return delta === 0 ? null : { delta };
  }
  if (/^\d+$/.test(value)) return { quantity: Number(value) };
  return null;
}
