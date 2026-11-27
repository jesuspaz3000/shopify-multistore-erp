import { sql } from 'drizzle-orm';
import { boolean, index, integer, numeric, pgTable, primaryKey, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { fk, id, timestamps, tsz } from '../../../../shared/database/columns.js';
import { tenants } from '../../../identity/identity.schema.js';
import { inventoryItems } from '../../../inventory/infrastructure/persistence/inventory.schema.js';
import { shops } from '../../../shops/shops.schema.js';

// Catálogo MAESTRO del ERP (sin IDs de Shopify): un mismo producto puede publicarse en N tiendas.
// Pendiente: media, bundles (product_variant_components), listings por tienda y metafields.

export const products = pgTable(
  'products',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    originShopId: fk().references(() => shops.id, { onDelete: 'set null' }), // tienda de la que se importó
    title: varchar({ length: 255 }).notNull(),
    descriptionHtml: text(),
    vendor: varchar({ length: 255 }),
    productType: varchar({ length: 255 }),
    categoryGid: varchar({ length: 255 }), // gid://shopify/TaxonomyCategory/...
    handle: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 20 }).notNull().default('ACTIVE'), // ACTIVE | DRAFT | ARCHIVED
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    seoTitle: varchar({ length: 255 }),
    seoDescription: text(),
    templateSuffix: varchar({ length: 100 }),
    isGiftCard: boolean().notNull().default(false),
    requiresSellingPlan: boolean().notNull().default(false),
    hasVariantsThatRequireComponents: boolean().notNull().default(false),
    combinedListingRole: varchar({ length: 10 }), // PARENT | CHILD
    version: integer().notNull().default(1), // concurrencia optimista
    deletedAt: tsz(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('products_tenant_handle_uq').on(t.tenantId, t.handle).where(sql`${t.deletedAt} is null`),
    index('products_tenant_status_idx').on(t.tenantId, t.status),
    index('products_tenant_vendor_idx').on(t.tenantId, t.vendor),
    index('products_tenant_deleted_idx').on(t.tenantId, t.deletedAt),
  ],
);

/** Opciones que definen las variantes (Color, Talla...; máx. 3). */
export const productOptions = pgTable(
  'product_options',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: fk()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    position: integer().notNull(),
    linkedMetafieldNamespace: varchar({ length: 255 }),
    linkedMetafieldKey: varchar({ length: 255 }),
  },
  (t) => [
    uniqueIndex('product_options_product_position_uq').on(t.productId, t.position),
    index('product_options_tenant_product_idx').on(t.tenantId, t.productId),
  ],
);

export const productOptionValues = pgTable(
  'product_option_values',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    optionId: fk()
      .notNull()
      .references(() => productOptions.id, { onDelete: 'cascade' }),
    productId: fk()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    position: integer().notNull(),
    hasVariants: boolean().notNull().default(true),
    swatchColor: varchar({ length: 20 }),
    swatchImageMediaId: fk(), // FK a media cuando exista
    linkedMetafieldValue: text(),
  },
  (t) => [
    uniqueIndex('product_option_values_option_name_uq').on(t.optionId, t.name),
    index('product_option_values_tenant_product_idx').on(t.tenantId, t.productId),
  ],
);

/** SKU comprable. Peso y datos físicos viven en su inventory_item (1:1). */
export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: fk()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    title: varchar({ length: 255 }).notNull(), // "Rojo / XL" o "Default Title"
    displayName: varchar({ length: 255 }),
    sku: varchar({ length: 255 }),
    barcode: varchar({ length: 255 }),
    basePrice: numeric({ precision: 18, scale: 4 }), // precio de lista maestro
    compareAtPrice: numeric({ precision: 18, scale: 4 }), // precio "antes" (tachado)
    basePriceCurrency: varchar({ length: 3 }),
    inventoryPolicy: varchar({ length: 10 }).notNull().default('DENY'), // DENY | CONTINUE (vender sin stock)
    position: integer().notNull(),
    taxable: boolean().notNull().default(true),
    inventoryItemId: fk()
      .notNull()
      .unique()
      .references(() => inventoryItems.id),
    requiresComponents: boolean().notNull().default(false),
    version: integer().notNull().default(1),
    deletedAt: tsz(),
    ...timestamps,
  },
  (t) => [
    index('product_variants_tenant_product_idx').on(t.tenantId, t.productId),
    // SKU único entre las variantes vigentes de la empresa.
    uniqueIndex('product_variants_tenant_sku_uq')
      .on(t.tenantId, t.sku)
      .where(sql`${t.sku} is not null and ${t.deletedAt} is null`),
    index('product_variants_tenant_barcode_idx').on(t.tenantId, t.barcode),
    index('product_variants_tenant_deleted_idx').on(t.tenantId, t.deletedAt),
  ],
);

/**
 * Archivo multimedia MAESTRO (copia en el almacenamiento del ERP, desde donde se sube a cada tienda).
 * `storage_key` es la ruta interna del archivo (disco local o S3): la URL se arma al servirlo.
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    mediaContentType: varchar({ length: 20 }).notNull().default('IMAGE'), // IMAGE | VIDEO | EXTERNAL_VIDEO | MODEL_3D
    storageKey: varchar({ length: 500 }).notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    alt: varchar({ length: 512 }),
    width: integer(),
    height: integer(),
    fileSize: integer().notNull(),
    checksumSha256: varchar({ length: 64 }).notNull(),
    ...timestamps,
  },
  (t) => [index('media_tenant_checksum_idx').on(t.tenantId, t.checksumSha256)],
);

/** Product.media: imágenes del producto en orden (posición 1 = principal). */
export const productMedia = pgTable(
  'product_media',
  {
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: fk()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaId: fk()
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.mediaId] }), index('product_media_tenant_media_idx').on(t.tenantId, t.mediaId)],
);

/** ProductVariant.selectedOptions: variante <-> valores de opción (Rojo + XL). */
export const variantOptionValues = pgTable(
  'variant_option_values',
  {
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    variantId: fk()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    optionValueId: fk()
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.optionValueId] })],
);
