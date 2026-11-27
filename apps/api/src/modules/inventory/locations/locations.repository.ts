import { Inject, Injectable } from '@nestjs/common';
import { type LocationShopLink, likePattern, type PaginationQuery } from '@erp/contracts';
import { and, asc, count, eq, ilike, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { shops } from '../../shops/shops.schema.js';
import { inventoryLevels, locations, shopLocations } from '../infrastructure/persistence/inventory.schema.js';

type Executor = Database | Tx;
export type LocationRow = typeof locations.$inferSelect;

@Injectable()
export class LocationsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Bodegas vigentes (no eliminadas) de la empresa, con búsqueda opcional. */
  private activeFilter(tenantId: number, q?: string) {
    const filters = [eq(locations.tenantId, tenantId), isNull(locations.deletedAt)];
    if (q) {
      const pattern = likePattern(q);
      filters.push(or(ilike(locations.code, pattern), ilike(locations.name, pattern), ilike(locations.city, pattern))!);
    }
    return and(...filters);
  }

  async listPage(tenantId: number, query: PaginationQuery, tx: Executor = this.db) {
    const where = this.activeFilter(tenantId, query.q);
    const [items, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(locations)
        .where(where)
        .orderBy(asc(locations.name), asc(locations.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(locations).where(where),
    ]);
    return { items, total };
  }

  /** Bodegas activas (id, código, nombre) para selectores. */
  options(tenantId: number, tx: Executor = this.db) {
    return tx
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(and(this.activeFilter(tenantId), eq(locations.isActive, true)))
      .orderBy(asc(locations.name), asc(locations.id));
  }

  async findById(tenantId: number, locationId: number, tx: Executor = this.db): Promise<LocationRow | undefined> {
    const [row] = await tx
      .select()
      .from(locations)
      .where(and(this.activeFilter(tenantId), eq(locations.id, locationId)))
      .limit(1);
    return row;
  }

  async insert(values: typeof locations.$inferInsert, tx: Executor = this.db): Promise<LocationRow> {
    const [row] = await tx.insert(locations).values(values).returning();
    return row;
  }

  async update(
    tenantId: number,
    locationId: number,
    values: Partial<typeof locations.$inferInsert>,
    tx: Executor = this.db,
  ): Promise<LocationRow | undefined> {
    const [row] = await tx
      .update(locations)
      .set(values)
      .where(and(this.activeFilter(tenantId), eq(locations.id, locationId)))
      .returning();
    return row;
  }

  /**
   * Vínculos con tiendas de varias bodegas, agrupados por bodega.
   * `onlyShopIds` restringe a las tiendas que el usuario puede ver (null = todas).
   */
  async shopLinks(
    tenantId: number,
    locationIds: number[],
    onlyShopIds: number[] | null,
    tx: Executor = this.db,
  ): Promise<Map<number, LocationShopLink[]>> {
    const result = new Map<number, LocationShopLink[]>(locationIds.map((id) => [id, []]));
    if (locationIds.length === 0) return result;
    const filters = [eq(shopLocations.tenantId, tenantId), inArray(shopLocations.locationId, locationIds)];
    if (onlyShopIds) filters.push(inArray(shopLocations.shopId, onlyShopIds.length > 0 ? onlyShopIds : [-1]));
    const rows = await tx
      .select({
        locationId: shopLocations.locationId,
        shopId: shopLocations.shopId,
        stockSyncMode: shopLocations.stockSyncMode,
        stockPercentage: shopLocations.stockPercentage,
        stockBuffer: shopLocations.stockBuffer,
      })
      .from(shopLocations)
      .innerJoin(shops, eq(shops.id, shopLocations.shopId))
      .where(and(...filters))
      .orderBy(asc(shops.name), asc(shops.id));
    for (const { locationId, ...link } of rows) {
      result.get(locationId)?.push({ ...link, stockSyncMode: link.stockSyncMode as LocationShopLink['stockSyncMode'] });
    }
    return result;
  }

  /** Ids de tiendas de la empresa entre los indicados (para validar los que llegan en el body). */
  async existingShopIds(tenantId: number, shopIds: number[], tx: Executor = this.db): Promise<Set<number>> {
    if (shopIds.length === 0) return new Set();
    const rows = await tx
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), inArray(shops.id, shopIds)));
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Reemplaza los vínculos de la bodega con las tiendas del ámbito del usuario (`scopeShopIds`,
   * null = todas): borra los que ya no están y crea o actualiza el resto. Los vínculos con tiendas
   * fuera de su ámbito no se tocan.
   */
  async replaceShopLinks(
    tenantId: number,
    locationId: number,
    links: LocationShopLink[],
    scopeShopIds: number[] | null,
    tx: Executor,
  ): Promise<void> {
    const keep = links.map((l) => l.shopId);
    const scope = [eq(shopLocations.tenantId, tenantId), eq(shopLocations.locationId, locationId)];
    if (scopeShopIds) scope.push(inArray(shopLocations.shopId, scopeShopIds.length > 0 ? scopeShopIds : [-1]));
    if (keep.length > 0) scope.push(notInArray(shopLocations.shopId, keep));
    await tx.delete(shopLocations).where(and(...scope));

    for (const link of links) {
      const rule = { stockSyncMode: link.stockSyncMode, stockPercentage: link.stockPercentage, stockBuffer: link.stockBuffer };
      await tx
        .insert(shopLocations)
        .values({ tenantId, locationId, shopId: link.shopId, ...rule })
        .onConflictDoUpdate({ target: [shopLocations.shopId, shopLocations.locationId], set: rule });
    }
  }

  /** Unidades físicas (on_hand) que hay en la bodega. */
  async unitsOnHand(tenantId: number, locationId: number, tx: Executor = this.db): Promise<number> {
    const [row] = await tx
      .select({ units: sql<number>`coalesce(sum(${inventoryLevels.onHand}), 0)::int` })
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.tenantId, tenantId), eq(inventoryLevels.locationId, locationId)));
    return row.units;
  }

  /** Al eliminar una bodega deja de abastecer a todas las tiendas. */
  async deleteShopLinks(tenantId: number, locationId: number, tx: Executor): Promise<void> {
    await tx
      .delete(shopLocations)
      .where(and(eq(shopLocations.tenantId, tenantId), eq(shopLocations.locationId, locationId)));
  }
}
