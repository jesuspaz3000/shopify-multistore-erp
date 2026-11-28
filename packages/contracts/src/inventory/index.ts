import { z } from 'zod';
import { paginationQuerySchema } from '../common/index.js';

// ---------- Catálogos ----------

/** Motivos de ajuste (equivalen a los "reason" de inventoryAdjustQuantities en Shopify). */
export const ADJUSTMENT_REASONS = [
  'initial',
  'received',
  'correction',
  'cycle_count_available',
  'damaged',
  'shrinkage',
  'restock',
  'other',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** Motivos que se eligen al ajustar a mano ('initial' lo pone el sistema al crear la variante con stock). */
export const MANUAL_ADJUSTMENT_REASONS = ADJUSTMENT_REASONS.filter((r) => r !== 'initial') as Exclude<AdjustmentReason, 'initial'>[];

/** Máximo de líneas por ajuste (como un documento de inventario). */
export const MAX_ADJUSTMENT_CHANGES = 250;

// ---------- Query ----------

const optionalId = z.coerce.number().int().positive().optional().catch(undefined);

/** Stock por variante: de una bodega (?locationId) o la suma de todas. */
export const inventoryQuerySchema = paginationQuerySchema.extend({ locationId: optionalId });
export type InventoryQuery = z.output<typeof inventoryQuerySchema>;

/** Historial de movimientos (kardex). */
export const adjustmentsQuerySchema = paginationQuerySchema.extend({ locationId: optionalId, inventoryItemId: optionalId });
export type AdjustmentsQuery = z.output<typeof adjustmentsQuerySchema>;

// ---------- Requests ----------

const adjustmentChangeSchema = z
  .object({
    inventoryItemId: z.number().int().positive(),
    /** Sumar o restar unidades (ej. +10 al recibir mercadería). */
    delta: z.number().int('Debe ser un número entero').refine((n) => n !== 0, 'El cambio no puede ser 0').optional(),
    /** Nueva cantidad disponible (ej. tras un conteo). */
    quantity: z.number().int('Debe ser un número entero').min(0, 'No puede ser negativa').max(1_000_000_000).optional(),
    /** Cantidad que el usuario vio: si cambió desde entonces, el ajuste se rechaza (compare-and-set). */
    compareQuantity: z.number().int().optional(),
  })
  .refine((c) => (c.delta === undefined) !== (c.quantity === undefined), 'Indica un cambio (delta) o una nueva cantidad');

export const adjustInventorySchema = z.object({
  locationId: z.number().int().positive(),
  reason: z.enum(MANUAL_ADJUSTMENT_REASONS as [Exclude<AdjustmentReason, 'initial'>, ...Exclude<AdjustmentReason, 'initial'>[]], 'Motivo inválido'),
  note: z
    .union([z.literal(''), z.string().trim().max(255)])
    .nullish()
    .transform((value) => (value ? value : null)),
  changes: z
    .array(adjustmentChangeSchema)
    .min(1, 'No hay cambios')
    .max(MAX_ADJUSTMENT_CHANGES, `Máximo ${MAX_ADJUSTMENT_CHANGES} cambios por ajuste`)
    .refine((list) => new Set(list.map((c) => c.inventoryItemId)).size === list.length, 'Una variante aparece dos veces'),
});
export type AdjustInventoryInput = z.input<typeof adjustInventorySchema>;
export type AdjustInventoryData = z.output<typeof adjustInventorySchema>;

// ---------- Responses ----------

/** Stock de una variante (en una bodega o sumado). */
export type InventoryRow = {
  inventoryItemId: number;
  variantId: number;
  productId: number;
  productTitle: string;
  /** null = producto sin variantes ("Default Title"). */
  variantTitle: string | null;
  /** Imagen principal del producto (url relativa a la API) o null. */
  imageUrl: string | null;
  sku: string | null;
  /** Disponible para vender. */
  available: number;
  /** Comprometido en pedidos aún no despachados. */
  committed: number;
  /** Reservado + dañado + stock de seguridad + en control de calidad. */
  unavailable: number;
  /** Físicamente en bodega (= disponible + comprometido + no disponible). */
  onHand: number;
  /** En camino (no suma al físico). */
  incoming: number;
  /** Vista "Todas las bodegas": disponible en cada bodega con stock registrado (vacío al ver una bodega). */
  levels: { locationId: number; available: number }[];
};

export type AdjustInventoryResponse = {
  /** Cantidades resultantes por ítem en la bodega. */
  levels: { inventoryItemId: number; available: number; onHand: number }[];
};

/** Movimiento del kardex. */
export type AdjustmentResponse = {
  id: number;
  createdAt: string;
  inventoryItemId: number;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  locationId: number;
  locationName: string;
  locationCode: string;
  delta: number;
  quantityAfter: number | null;
  reason: AdjustmentReason;
  note: string | null;
  source: 'ERP' | 'SHOPIFY';
  userName: string | null;
};
