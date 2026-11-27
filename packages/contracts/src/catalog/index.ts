import { z } from 'zod';
import { paginationQuerySchema } from '../common/index.js';

// ---------- Catálogos ----------

/** Ciclo de vida del producto en el ERP (el estado en cada tienda llegará con la publicación). */
export const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const WEIGHT_UNITS = ['GRAMS', 'KILOGRAMS', 'OUNCES', 'POUNDS'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** Límites de Shopify: 3 opciones por producto y 2048 variantes. */
export const MAX_PRODUCT_OPTIONS = 3;
export const MAX_PRODUCT_VARIANTS = 2048;

/** Título de la variante única de un producto sin opciones (como en Shopify). */
export const DEFAULT_VARIANT_TITLE = 'Default Title';

// ---------- Query ----------

export const productsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PRODUCT_STATUSES).optional().catch(undefined),
});
export type ProductsQuery = z.output<typeof productsQuerySchema>;

// ---------- Campos ----------

/** Texto opcional: '' o ausente = null. */
const nullableText = (max: number) =>
  z
    .union([z.literal(''), z.string().trim().max(max, `Máximo ${max} caracteres`)])
    .nullish()
    .transform((value) => (value ? value : null));

/** Monto decimal como texto (sin errores de redondeo): "19.90". '' = sin monto. */
const decimal = (integerDigits: number, message: string) =>
  z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(new RegExp(`^\\d{1,${integerDigits}}(\\.\\d{1,4})?$`), message),
    ])
    .nullish()
    .transform((value) => (value ? value : null));

export const moneySchema = decimal(14, 'Monto inválido (ej. 19.90)');

/** Precio obligatorio (como en Shopify: puede ser 0, no puede quedar vacío). */
const requiredPriceSchema = z
  .string('El precio no puede quedar vacío')
  .trim()
  .min(1, 'El precio no puede quedar vacío')
  .regex(/^\d{1,14}(\.\d{1,4})?$/, 'Monto inválido (ej. 19.90)');

/** Qué hacer al agotarse: DENY = dejar de vender · CONTINUE = seguir vendiendo (Shopify inventoryPolicy). */
export const INVENTORY_POLICIES = ['DENY', 'CONTINUE'] as const;
export type InventoryPolicy = (typeof INVENTORY_POLICIES)[number];

/** URL del producto: minúsculas, números y guiones (ej. polera-basica). */
export const productHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones (ej. polera-basica)');
const weightSchema = decimal(8, 'Peso inválido (ej. 0.5)');

const uniqueTexts = (label: string) => (list: string[]) =>
  new Set(list.map((v) => v.toLowerCase())).size === list.length || `${label} repetido`;

// ---------- Requests ----------

export const productOptionInputSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la opción').max(255),
  values: z
    .array(z.string().trim().min(1).max(255))
    .min(1, 'Agrega al menos un valor')
    .max(100, 'Máximo 100 valores')
    .refine((list) => uniqueTexts('Valor')(list) === true, 'Hay un valor repetido'),
});

export const variantInputSchema = z.object({
  /** Variante existente (al editar). Sin id = variante nueva. */
  id: z.number().int().positive().optional(),
  /** Un valor por opción, en el orden de las opciones. */
  optionValues: z.array(z.string().trim().min(1).max(255)).max(MAX_PRODUCT_OPTIONS),
  sku: nullableText(255),
  barcode: nullableText(255),
  price: requiredPriceSchema,
  /** Precio "antes" (tachado). Debe ser mayor que el precio. */
  compareAtPrice: moneySchema,
  cost: moneySchema,
  tracked: z.boolean().default(true),
  inventoryPolicy: z.enum(INVENTORY_POLICIES).default('DENY'),
  requiresShipping: z.boolean().default(true),
  taxable: z.boolean().default(true),
  weight: weightSchema,
  weightUnit: z.enum(WEIGHT_UNITS).default('KILOGRAMS'),
});
export type VariantInput = z.input<typeof variantInputSchema>;

export const productInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Escribe el título').max(255),
    description: nullableText(50_000),
    vendor: nullableText(255),
    productType: nullableText(255),
    status: z.enum(PRODUCT_STATUSES, 'Estado inválido').default('DRAFT'),
    tags: z
      .array(z.string().trim().min(1).max(255))
      .max(250)
      .default([])
      .transform((list) => [...new Map(list.map((t) => [t.toLowerCase(), t])).values()]),
    options: z
      .array(productOptionInputSchema)
      .max(MAX_PRODUCT_OPTIONS, `Máximo ${MAX_PRODUCT_OPTIONS} opciones`)
      .default([])
      .refine((list) => uniqueTexts('Opción')(list.map((o) => o.name)) === true, 'Hay dos opciones con el mismo nombre'),
    variants: z
      .array(variantInputSchema)
      .min(1, 'El producto necesita al menos una variante')
      .max(MAX_PRODUCT_VARIANTS, `Máximo ${MAX_PRODUCT_VARIANTS} variantes`),
    /** Ficha en buscadores (Shopify: título hasta 70 caracteres, descripción hasta 160). */
    seoTitle: nullableText(70),
    seoDescription: nullableText(160),
    /** URL del producto. Vacío al crear = se genera desde el título. */
    handle: z
      .union([z.literal(''), productHandleSchema])
      .nullish()
      .transform((value) => (value ? value : null)),
    /** Versión que se editó (al guardar cambios): si otro la cambió antes, se rechaza. */
    version: z.number().int().positive().optional(),
  })
  .superRefine((product, ctx) => {
    const { options, variants } = product;
    if (options.length === 0 && variants.length > 1) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Sin opciones el producto tiene una sola variante' });
    }
    const combos = new Set<string>();
    const skus = new Set<string>();
    variants.forEach((variant, index) => {
      if (variant.optionValues.length !== options.length) {
        ctx.addIssue({ code: 'custom', path: ['variants', index, 'optionValues'], message: 'Faltan valores de opción' });
        return;
      }
      variant.optionValues.forEach((value, i) => {
        if (!options[i].values.some((v) => v.toLowerCase() === value.toLowerCase())) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', index, 'optionValues'],
            message: `"${value}" no es un valor de ${options[i].name}`,
          });
        }
      });
      const combo = variant.optionValues.map((v) => v.toLowerCase()).join('\u0000');
      if (combos.has(combo)) {
        ctx.addIssue({ code: 'custom', path: ['variants', index, 'optionValues'], message: 'Variante repetida' });
      }
      combos.add(combo);
      if (variant.compareAtPrice && Number(variant.compareAtPrice) <= Number(variant.price)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'compareAtPrice'],
          message: 'Debe ser mayor que el precio',
        });
      }
      if (variant.sku) {
        const sku = variant.sku.toLowerCase();
        if (skus.has(sku)) ctx.addIssue({ code: 'custom', path: ['variants', index, 'sku'], message: 'SKU repetido' });
        skus.add(sku);
      }
    });
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

// ---------- Responses ----------

export type ProductListItem = {
  id: number;
  title: string;
  handle: string;
  status: ProductStatus;
  vendor: string | null;
  productType: string | null;
  variantsCount: number;
  /** Rango de precios de lista de sus variantes (null si ninguna tiene precio). */
  minPrice: string | null;
  maxPrice: string | null;
  currency: string;
  updatedAt: string;
};

export type VariantResponse = {
  id: number;
  title: string;
  optionValues: string[];
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  cost: string | null;
  tracked: boolean;
  inventoryPolicy: InventoryPolicy;
  requiresShipping: boolean;
  taxable: boolean;
  weight: string | null;
  weightUnit: WeightUnit;
  /** Ítem de inventario de la variante (stock por bodega). */
  inventoryItemId: number;
  /** Disponible sumando todas las bodegas. */
  available: number;
};

export type ProductResponse = {
  id: number;
  title: string;
  handle: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  status: ProductStatus;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  options: { name: string; values: string[] }[];
  variants: VariantResponse[];
  /** Moneda de los precios de lista (moneda de reporte de la empresa). */
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
