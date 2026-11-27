import { boolean, index, integer, pgTable, primaryKey, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { fk, id, timestamps, tsz } from '../../shared/database/columns.js';
import { roles, tenants, tenantUsers } from '../identity/identity.schema.js';

// Tiendas Shopify. Se crean "pendientes de conexión" y se conectan con las credenciales de una app
// del Dev Dashboard de Shopify (client credentials grant: el token dura 24 h y se renueva solo).
export const shops = pgTable(
  'shops',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    handle: varchar({ length: 63 }).notNull(), // usado en la URL: /{tenant}/{handle}/...
    shopifyGid: varchar({ length: 255 }).unique(),
    shopifyLegacyId: fk().unique(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }),
    contactEmail: varchar({ length: 255 }),
    primaryDomain: varchar({ length: 255 }),
    myshopifyDomain: varchar({ length: 255 }).unique(),
    currencyCode: varchar({ length: 3 }).notNull().default('USD'),
    enabledPresentmentCurrencies: text().array(),
    moneyFormat: varchar({ length: 50 }),
    ianaTimezone: varchar({ length: 100 }),
    planDisplayName: varchar({ length: 100 }),
    countryCode: varchar({ length: 2 }),
    taxesIncluded: boolean().notNull().default(false),
    primaryLocationId: fk(), // FK a shop_locations cuando exista el módulo de inventario
    apiVersion: varchar({ length: 10 }),
    // App del Dev Dashboard: el Client ID no es secreto; el secret va cifrado (AES-256-GCM).
    shopifyClientId: varchar({ length: 255 }),
    encryptedClientSecret: text(),
    encryptedAccessToken: text(),
    encryptedRefreshToken: text(),
    tokenExpiresAt: tsz(),
    encryptionKeyVersion: integer().notNull().default(1),
    grantedScopes: text().array(),
    // pending_connection = creada en el ERP, aún sin conectar con Shopify
    status: varchar({ length: 20 }).notNull().default('pending_connection'),
    installedAt: tsz(),
    uninstalledAt: tsz(),
    ...timestamps,
  },
  (t) => [
    index('shops_tenant_status_idx').on(t.tenantId, t.status),
    uniqueIndex('shops_tenant_handle_uq').on(t.tenantId, t.handle), // handle único por empresa (va en la URL)
  ],
);

// Restricción opcional de acceso por tienda (cuando tenant_users.all_shops_access = false).
export const tenantUserShops = pgTable(
  'tenant_user_shops',
  {
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tenantUserId: fk()
      .notNull()
      .references(() => tenantUsers.id, { onDelete: 'cascade' }),
    shopId: fk()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    roleId: fk().references(() => roles.id),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantUserId, t.shopId] }),
    index('tenant_user_shops_tenant_shop_idx').on(t.tenantId, t.shopId),
  ],
);
