import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { fk, id, timestamps, tsz } from '../../../../shared/database/columns.js';
import { tenants, users } from '../../../identity/identity.schema.js';
import { shops } from '../../../shops/shops.schema.js';

// Tablas ORM de inventario: ítems, bodegas, vínculo bodega-tienda, stock por bodega y kardex.
// Pendiente: shop_inventory_levels (espejo de lo publicado en cada tienda, llega con Shopify).

/**
 * Ítem de inventario MAESTRO (físico, costo, aduana, peso). 1:1 con una variante del catálogo.
 * En cada tienda existe un InventoryItem distinto (su GID irá en shopify_resource_links).
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sku: varchar({ length: 255 }),
    tracked: boolean().notNull().default(true), // si se lleva control de stock
    requiresShipping: boolean().notNull().default(true),
    unitCost: numeric({ precision: 18, scale: 4 }),
    unitCostCurrency: varchar({ length: 3 }),
    countryCodeOfOrigin: varchar({ length: 2 }),
    provinceCodeOfOrigin: varchar({ length: 10 }),
    harmonizedSystemCode: varchar({ length: 20 }),
    countryHarmonizedSystemCodes: jsonb(), // [{countryCode, harmonizedSystemCode}]
    weightValue: numeric({ precision: 12, scale: 4 }),
    weightUnit: varchar({ length: 10 }), // GRAMS | KILOGRAMS | OUNCES | POUNDS
    version: integer().notNull().default(1),
    ...timestamps,
  },
  (t) => [index('inventory_items_tenant_sku_idx').on(t.tenantId, t.sku)],
);

/** Ubicación física MAESTRA del ERP. Una bodega puede abastecer a varias tiendas. */
export const locations = pgTable(
  'locations',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar({ length: 50 }).notNull(), // código interno, ej. BOD-LIMA-01
    type: varchar({ length: 20 }).notNull().default('warehouse'), // warehouse | retail_store | 3pl | virtual
    name: varchar({ length: 255 }).notNull(),
    address1: varchar({ length: 255 }),
    address2: varchar({ length: 255 }),
    city: varchar({ length: 100 }),
    province: varchar({ length: 100 }),
    provinceCode: varchar({ length: 10 }),
    countryCode: varchar({ length: 2 }),
    zip: varchar({ length: 20 }),
    phone: varchar({ length: 50 }),
    isActive: boolean().notNull().default(true),
    deletedAt: tsz(), // baja lógica: el kardex futuro seguirá apuntando a la bodega
    ...timestamps,
  },
  (t) => [
    // Código único entre las bodegas vigentes: una bodega eliminada libera su código.
    uniqueIndex('locations_tenant_code_uq').on(t.tenantId, t.code).where(sql`${t.deletedAt} is null`),
    index('locations_tenant_deleted_idx').on(t.tenantId, t.deletedAt),
  ],
);

/**
 * Bodega ERP <-> Location de cada tienda Shopify, con la regla de cuánto stock se publica.
 * Los campos shopify_* se llenan al conectar la tienda; antes el vínculo existe solo en el ERP.
 */
export const shopLocations = pgTable(
  'shop_locations',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shopId: fk()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    locationId: fk()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    shopifyGid: varchar({ length: 255 }), // gid://shopify/Location/... en ESA tienda
    shopifyLegacyId: fk(),
    shopifyName: varchar({ length: 255 }),
    isActive: boolean().notNull().default(true),
    fulfillsOnlineOrders: boolean().notNull().default(false),
    shipsInventory: boolean().notNull().default(true),
    hasActiveInventory: boolean().notNull().default(false),
    fulfillmentServiceHandle: varchar({ length: 100 }),
    localPickupEnabled: boolean().notNull().default(false),
    // Regla de publicación de stock ERP -> Shopify
    stockSyncMode: varchar({ length: 20 }).notNull().default('MIRROR'), // MIRROR | PERCENTAGE | BUFFER | MANUAL | NONE
    stockPercentage: numeric({ precision: 5, scale: 2, mode: 'number' }),
    stockBuffer: integer(),
    shopifyUpdatedAt: tsz(),
    deactivatedAt: tsz(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('shop_locations_shop_gid_uq').on(t.shopId, t.shopifyGid),
    uniqueIndex('shop_locations_shop_location_uq').on(t.shopId, t.locationId), // una bodega = una Location por tienda
    index('shop_locations_tenant_location_idx').on(t.tenantId, t.locationId),
  ],
);

/**
 * Stock REAL (fuente de verdad del ERP) por ítem y bodega, con los estados de Shopify.
 * on_hand = available + committed + reserved + damaged + safety_stock + quality_control (incoming no suma).
 */
export const inventoryLevels = pgTable(
  'inventory_levels',
  {
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    inventoryItemId: fk()
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    locationId: fk()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    available: integer().notNull().default(0),
    committed: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    damaged: integer().notNull().default(0),
    safetyStock: integer().notNull().default(0),
    qualityControl: integer().notNull().default(0),
    onHand: integer().notNull().default(0),
    incoming: integer().notNull().default(0),
    updatedAt: tsz()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.inventoryItemId, t.locationId] }),
    index('inventory_levels_tenant_location_idx').on(t.tenantId, t.locationId),
  ],
);

/**
 * Kardex: cada movimiento de stock. Con Shopify se sincroniza por DELTAS (inventoryAdjustQuantities),
 * nunca sobrescribiendo el total, para no perder ventas concurrentes.
 */
export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shopId: fk().references(() => shops.id, { onDelete: 'set null' }),
    inventoryItemId: fk()
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    locationId: fk()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    shopifyGroupGid: varchar({ length: 255 }), // gid://shopify/InventoryAdjustmentGroup/...
    quantityName: varchar({ length: 30 }).notNull(), // available | on_hand | damaged | ...
    delta: integer().notNull(),
    quantityAfter: integer(),
    reason: varchar({ length: 40 }).notNull(),
    referenceDocumentUri: varchar({ length: 500 }), // ej. gid://erp/PurchaseOrder/123
    source: varchar({ length: 20 }).notNull(), // ERP | SHOPIFY
    userId: fk().references(() => users.id, { onDelete: 'set null' }),
    note: varchar({ length: 255 }),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [
    index('inventory_adjustments_item_location_idx').on(t.tenantId, t.inventoryItemId, t.locationId, t.createdAt),
    index('inventory_adjustments_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('inventory_adjustments_reference_idx').on(t.tenantId, t.referenceDocumentUri),
  ],
);
