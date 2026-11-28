import { index, integer, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { fk, id, timestamps, tsz } from '../../../../shared/database/columns.js';
import { tenants } from '../../../identity/identity.schema.js';
import { shops } from '../../../shops/shops.schema.js';

// Tablas de sincronización multi-tienda. Pendiente: sync_jobs y sync_states (cola y cursores).

/** Recursos de Shopify que se vinculan con una entidad maestra del ERP. */
export const SHOPIFY_RESOURCE_TYPES = ['PRODUCT', 'PRODUCT_VARIANT', 'INVENTORY_ITEM', 'MEDIA'] as const;
export type ShopifyResourceType = (typeof SHOPIFY_RESOURCE_TYPES)[number];

/**
 * IDENTIDAD: qué GID tiene cada entidad maestra en cada tienda (un producto en 3 tiendas = 3 filas).
 * Evita duplicar al volver a importar y resuelve webhook -> entidad ERP.
 */
export const shopifyResourceLinks = pgTable(
  'shopify_resource_links',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shopId: fk()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    resourceType: varchar({ length: 30 }).notNull().$type<ShopifyResourceType>(),
    erpId: fk().notNull(), // FK polimórfica: products.id, product_variants.id, inventory_items.id o media.id
    shopifyGid: varchar({ length: 255 }).notNull(),
    shopifyLegacyId: fk(),
    remoteUrl: varchar({ length: 1000 }),
    syncStatus: varchar({ length: 20 }).notNull().default('synced'), // synced | pending_push | pending_pull | conflict | error
    erpVersionSynced: integer(),
    shopifyUpdatedAt: tsz(), // updatedAt de Shopify en el último pull
    syncedAt: tsz(),
    lastError: text(),
    unlinkedAt: tsz(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('shopify_resource_links_shop_gid_uq').on(t.shopId, t.shopifyGid),
    uniqueIndex('shopify_resource_links_shop_type_erp_uq').on(t.shopId, t.resourceType, t.erpId),
    index('shopify_resource_links_tenant_type_erp_idx').on(t.tenantId, t.resourceType, t.erpId),
    index('shopify_resource_links_shop_status_idx').on(t.shopId, t.syncStatus),
  ],
);
