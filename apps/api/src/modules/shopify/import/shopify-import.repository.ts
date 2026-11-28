import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, like, notInArray, or, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { media, products } from '../../catalog/infrastructure/persistence/catalog.schema.js';
import { locations, shopLocations } from '../../inventory/infrastructure/persistence/inventory.schema.js';
import { type ShopifyResourceType, shopifyResourceLinks } from '../../sync/infrastructure/persistence/sync.schema.js';

type Executor = Database | Tx;

export type LinkInput = { resourceType: ShopifyResourceType; erpId: number; shopifyGid: string; shopifyUpdatedAt?: Date; remoteUrl?: string };

/** Consultas de la importación: vínculos ERP <-> Shopify y emparejamiento de ubicaciones con bodegas. */
@Injectable()
export class ShopifyImportRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Vínculos de la tienda por GID: gid -> { erpId, shopifyUpdatedAt }. */
  async links(shopId: number, resourceType: ShopifyResourceType, gids: string[], tx: Executor = this.db) {
    const result = new Map<string, { erpId: number; shopifyUpdatedAt: Date | null }>();
    if (gids.length === 0) return result;
    const rows = await tx
      .select({ gid: shopifyResourceLinks.shopifyGid, erpId: shopifyResourceLinks.erpId, shopifyUpdatedAt: shopifyResourceLinks.shopifyUpdatedAt })
      .from(shopifyResourceLinks)
      .where(
        and(
          eq(shopifyResourceLinks.shopId, shopId),
          eq(shopifyResourceLinks.resourceType, resourceType),
          inArray(shopifyResourceLinks.shopifyGid, gids),
          isNull(shopifyResourceLinks.unlinkedAt),
        ),
      );
    for (const r of rows) result.set(r.gid, { erpId: r.erpId, shopifyUpdatedAt: r.shopifyUpdatedAt });
    return result;
  }

  /**
   * Crea o actualiza vínculos. Una entidad ERP tiene un solo recurso por tienda: si ya estaba
   * vinculada con otro GID (ej. el producto se recreó en Shopify), el vínculo viejo se reemplaza.
   */
  async upsertLinks(tenantId: number, shopId: number, links: LinkInput[], tx: Tx): Promise<void> {
    const now = new Date();
    for (const link of links) {
      await tx
        .delete(shopifyResourceLinks)
        .where(
          and(
            eq(shopifyResourceLinks.shopId, shopId),
            eq(shopifyResourceLinks.resourceType, link.resourceType),
            eq(shopifyResourceLinks.erpId, link.erpId),
            sql`${shopifyResourceLinks.shopifyGid} <> ${link.shopifyGid}`,
          ),
        );
      const values = {
        resourceType: link.resourceType,
        erpId: link.erpId,
        shopifyUpdatedAt: link.shopifyUpdatedAt ?? null,
        remoteUrl: link.remoteUrl?.slice(0, 1000) ?? null,
        syncStatus: 'synced',
        syncedAt: now,
        lastError: null,
        unlinkedAt: null,
      };
      await tx
        .insert(shopifyResourceLinks)
        .values({ tenantId, shopId, shopifyGid: link.shopifyGid, ...values })
        .onConflictDoUpdate({ target: [shopifyResourceLinks.shopId, shopifyResourceLinks.shopifyGid], set: values });
    }
  }

  /** Productos vigentes de la empresa entre los indicados -> su categoría (GID o null). */
  async activeProductCategories(tenantId: number, ids: number[], tx: Executor = this.db): Promise<Map<number, string | null>> {
    if (ids.length === 0) return new Map();
    const rows = await tx
      .select({ id: products.id, categoryGid: products.categoryGid })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), inArray(products.id, ids), isNull(products.deletedAt)));
    return new Map(rows.map((r) => [r.id, r.categoryGid]));
  }

  /** Completa la categoría de un producto (sin tocar sus demás datos; sube la versión). */
  async setProductCategory(tenantId: number, productId: number, categoryGid: string, tx: Executor = this.db): Promise<void> {
    await tx
      .update(products)
      .set({ categoryGid, version: sql`${products.version} + 1` })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
  }

  /** De las imágenes indicadas, las que siguen guardadas en la empresa. */
  async existingMediaIds(tenantId: number, ids: number[], tx: Executor = this.db): Promise<Set<number>> {
    if (ids.length === 0) return new Set();
    const rows = await tx
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.tenantId, tenantId), inArray(media.id, ids)));
    return new Set(rows.map((r) => r.id));
  }

  /** Ubicaciones de Shopify ya emparejadas con una bodega vigente: gid -> bodega. */
  async linkedLocations(tenantId: number, shopId: number, tx: Executor = this.db): Promise<Map<string, number>> {
    const rows = await tx
      .select({ gid: shopLocations.shopifyGid, locationId: shopLocations.locationId })
      .from(shopLocations)
      .innerJoin(locations, eq(locations.id, shopLocations.locationId))
      .where(and(eq(shopLocations.tenantId, tenantId), eq(shopLocations.shopId, shopId), isNull(locations.deletedAt)));
    return new Map(rows.flatMap((r) => (r.gid ? [[r.gid, r.locationId] as const] : [])));
  }

  /** Bodega vigente con ese nombre (sin distinguir mayúsculas) que aún no abastece a la tienda con otra ubicación. */
  async unlinkedLocationByName(tenantId: number, shopId: number, name: string, tx: Executor = this.db) {
    const linked = tx
      .select({ id: shopLocations.locationId })
      .from(shopLocations)
      .where(and(eq(shopLocations.shopId, shopId), sql`${shopLocations.shopifyGid} is not null`));
    const [row] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, tenantId),
          isNull(locations.deletedAt),
          sql`lower(${locations.name}) = lower(${name})`,
          notInArray(locations.id, linked),
        ),
      )
      .limit(1);
    return row?.id;
  }

  /** Códigos de bodegas vigentes que empiezan como `base`. */
  async takenCodes(tenantId: number, base: string, tx: Executor = this.db): Promise<Set<string>> {
    const rows = await tx
      .select({ code: locations.code })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), isNull(locations.deletedAt), or(eq(locations.code, base), like(locations.code, `${base}-%`))));
    return new Set(rows.map((r) => r.code));
  }

  async insertLocation(values: typeof locations.$inferInsert, tx: Tx): Promise<number> {
    const [row] = await tx.insert(locations).values(values).returning({ id: locations.id });
    return row.id;
  }

  /** Bodega <-> ubicación de Shopify (con sus datos de Shopify). Conserva la regla de stock si ya existía. */
  async upsertShopLocation(
    values: Pick<
      typeof shopLocations.$inferInsert,
      'tenantId' | 'shopId' | 'locationId' | 'shopifyGid' | 'shopifyLegacyId' | 'shopifyName' | 'isActive' | 'fulfillsOnlineOrders' | 'hasActiveInventory' | 'fulfillmentServiceHandle'
    >,
    tx: Tx,
  ): Promise<void> {
    const { tenantId: _t, shopId: _s, locationId: _l, ...shopify } = values;
    await tx
      .insert(shopLocations)
      .values({ ...values, shopifyUpdatedAt: new Date() })
      .onConflictDoUpdate({ target: [shopLocations.shopId, shopLocations.locationId], set: { ...shopify, shopifyUpdatedAt: new Date() } });
  }
}
