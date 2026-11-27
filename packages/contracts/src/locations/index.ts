import { z } from 'zod';
import { countryCodeSchema } from '../shops/index.js';

// ---------- Catálogos ----------

/** Tipos de bodega (ubicación física del ERP). */
export const LOCATION_TYPES = ['warehouse', 'retail_store', '3pl', 'virtual'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

/**
 * Cuánto stock de la bodega se publica en una tienda:
 * MIRROR = todo lo disponible · PERCENTAGE = un % · BUFFER = disponible menos N unidades
 * MANUAL = se ajusta a mano en la tienda · NONE = no se sincroniza.
 */
export const STOCK_SYNC_MODES = ['MIRROR', 'PERCENTAGE', 'BUFFER', 'MANUAL', 'NONE'] as const;
export type StockSyncMode = (typeof STOCK_SYNC_MODES)[number];

// ---------- Campos ----------

/** Campo opcional al crear: '' = no informado. */
const optionalText = (max: number) =>
  z
    .union([z.literal(''), z.string().trim().max(max)])
    .optional()
    .transform((value) => (value ? value : undefined));

/** Campo opcional al editar: ausente = no cambia; '' = se borra (null). */
const clearableText = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .transform((value) => (value ? value : null))
    .optional();

export const locationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'Mínimo 2 caracteres')
  .max(50, 'Máximo 50 caracteres')
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'Solo letras, números, guion y guion bajo (ej. BOD-LIMA-01)');

const nameSchema = z.string().trim().min(2, 'Mínimo 2 caracteres').max(255);

// ---------- Requests ----------

export const createLocationSchema = z.object({
  code: locationCodeSchema,
  name: nameSchema,
  type: z.enum(LOCATION_TYPES, 'Tipo de bodega inválido').default('warehouse'),
  address1: optionalText(255),
  address2: optionalText(255),
  city: optionalText(100),
  province: optionalText(100),
  countryCode: z
    .union([z.literal(''), countryCodeSchema])
    .optional()
    .transform((value) => (value ? value : undefined)),
  zip: optionalText(20),
  phone: optionalText(50),
});
export type CreateLocationInput = z.input<typeof createLocationSchema>;
export type CreateLocationData = z.output<typeof createLocationSchema>;

export const updateLocationSchema = z.object({
  code: locationCodeSchema.optional(),
  name: nameSchema.optional(),
  type: z.enum(LOCATION_TYPES, 'Tipo de bodega inválido').optional(),
  address1: clearableText(z.string().trim().max(255)),
  address2: clearableText(z.string().trim().max(255)),
  city: clearableText(z.string().trim().max(100)),
  province: clearableText(z.string().trim().max(100)),
  countryCode: clearableText(countryCodeSchema),
  zip: clearableText(z.string().trim().max(20)),
  phone: clearableText(z.string().trim().max(50)),
  isActive: z.boolean().optional(),
});
export type UpdateLocationInput = z.input<typeof updateLocationSchema>;
export type UpdateLocationData = z.output<typeof updateLocationSchema>;

/** Regla de stock de una bodega en una tienda. Cada modo exige (solo) sus parámetros. */
export const locationShopLinkSchema = z
  .discriminatedUnion('stockSyncMode', [
    z.object({
      shopId: z.number().int().positive(),
      stockSyncMode: z.literal('PERCENTAGE'),
      stockPercentage: z.number('Indica el porcentaje').gt(0, 'Mayor que 0').max(100, 'Máximo 100'),
    }),
    z.object({
      shopId: z.number().int().positive(),
      stockSyncMode: z.literal('BUFFER'),
      stockBuffer: z.number('Indica las unidades').int('Debe ser entero').min(0, 'Mínimo 0'),
    }),
    z.object({ shopId: z.number().int().positive(), stockSyncMode: z.enum(['MIRROR', 'MANUAL', 'NONE']) }),
  ])
  .transform((link) => ({
    shopId: link.shopId,
    stockSyncMode: link.stockSyncMode as StockSyncMode,
    stockPercentage: 'stockPercentage' in link ? link.stockPercentage : null,
    stockBuffer: 'stockBuffer' in link ? link.stockBuffer : null,
  }));

/** Reemplaza las tiendas que abastece la bodega (solo entre las tiendas visibles para el usuario). */
export const setLocationShopsSchema = z.object({
  shops: z
    .array(locationShopLinkSchema)
    .max(500)
    .refine((list) => new Set(list.map((l) => l.shopId)).size === list.length, 'Una tienda aparece dos veces'),
});
export type SetLocationShopsInput = z.input<typeof setLocationShopsSchema>;
export type SetLocationShopsData = z.output<typeof setLocationShopsSchema>;
export type LocationShopLink = z.output<typeof locationShopLinkSchema>;

// ---------- Responses ----------

export type LocationResponse = {
  id: number;
  code: string;
  name: string;
  type: LocationType;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  countryCode: string | null;
  zip: string | null;
  phone: string | null;
  isActive: boolean;
  /** Tiendas que abastece (solo las visibles para el usuario). */
  shops: LocationShopLink[];
  createdAt: string;
};

/** Opción liviana de bodega activa para selectores (sin paginar). */
export type LocationOptionResponse = { id: number; code: string; name: string };
