import { Inject, Injectable } from '@nestjs/common';
import { type AdjustmentsQuery, type InventoryQuery, likePattern } from '@erp/contracts';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, sum } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { products, productVariants } from '../../catalog/infrastructure/persistence/catalog.schema.js';
import { users } from '../../identity/identity.schema.js';
import { inventoryAdjustments, inventoryItems, inventoryLevels, locations } from '../infrastructure/persistence/inventory.schema.js';

type Executor = Database | Tx;
export type LevelRow = typeof inventoryLevels.$inferSelect;

/** sum() de enteros devuelve bigint (texto en node-pg): se convierte a number. */
const total = (column: Parameters<typeof sum>[0]) => sql<number>`coalesce(${sum(column)}, 0)::int`;

@Injectable()
export class StockRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Variantes vigentes que controlan stock, con búsqueda por producto, variante o SKU. */
  private stockFilter(tenantId: number, q?: string) {
    const filters = [
      eq(productVariants.tenantId, tenantId),
      isNull(productVariants.deletedAt),
      isNull(products.deletedAt),
      eq(inventoryItems.tracked, true),
    ];
    if (q) {
      const pattern = likePattern(q);
      filters.push(or(ilike(products.title, pattern), ilike(productVariants.title, pattern), ilike(productVariants.sku, pattern))!);
    }
    return and(...filters);
  }

  /** Stock por variante en una bodega (`locationId`) o sumado en todas (undefined). */
  async listPage(tenantId: number, query: InventoryQuery, tx: Executor = this.db) {
    const where = this.stockFilter(tenantId, query.q);
    // Todas las bodegas = solo las vigentes (como la lista de Productos: los números coinciden).
    const levelJoin = query.locationId
      ? and(eq(inventoryLevels.inventoryItemId, inventoryItems.id), eq(inventoryLevels.locationId, query.locationId))
      : and(
          eq(inventoryLevels.inventoryItemId, inventoryItems.id),
          sql`exists (select 1 from locations l where l.id = ${inventoryLevels.locationId} and l.deleted_at is null)`,
        );
    const [items, [{ total: rows }]] = await Promise.all([
      tx
        .select({
          inventoryItemId: inventoryItems.id,
          variantId: productVariants.id,
          productId: products.id,
          productTitle: products.title,
          variantTitle: productVariants.title,
          sku: productVariants.sku,
          // Imagen principal del producto (columnas calificadas a mano: va dentro de una subconsulta).
          featuredMediaId: sql<number | null>`(
            select pm.media_id from product_media pm
            where pm.product_id = ${products.id} order by pm.position limit 1
          )::bigint`.mapWith(Number),
          available: total(inventoryLevels.available),
          committed: total(inventoryLevels.committed),
          unavailable: sql<number>`coalesce(sum(${inventoryLevels.reserved} + ${inventoryLevels.damaged} + ${inventoryLevels.safetyStock} + ${inventoryLevels.qualityControl}), 0)::int`,
          onHand: total(inventoryLevels.onHand),
          incoming: total(inventoryLevels.incoming),
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, productVariants.inventoryItemId))
        .leftJoin(inventoryLevels, levelJoin)
        .where(where)
        .groupBy(productVariants.id, products.id, inventoryItems.id)
        .orderBy(asc(products.title), asc(products.id), asc(productVariants.position), asc(productVariants.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx
        .select({ total: count() })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, productVariants.inventoryItemId))
        .where(where),
    ]);
    return { items, total: rows };
  }

  /** Bodega vigente y activa de la empresa. */
  async findActiveLocation(tenantId: number, locationId: number, tx: Executor = this.db) {
    const [row] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId), isNull(locations.deletedAt), eq(locations.isActive, true)))
      .limit(1);
    return row;
  }

  /** De los ítems indicados, los que son de variantes vigentes de la empresa y controlan stock. */
  async adjustableItemIds(tenantId: number, itemIds: number[], tx: Executor = this.db): Promise<Set<number>> {
    const rows = await tx
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(productVariants.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(
          eq(inventoryItems.tenantId, tenantId),
          inArray(inventoryItems.id, itemIds),
          eq(inventoryItems.tracked, true),
          isNull(productVariants.deletedAt),
          isNull(products.deletedAt),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Niveles de los ítems en la bodega, BLOQUEADOS hasta el fin de la transacción (FOR UPDATE):
   * dos ajustes simultáneos del mismo ítem se aplican uno detrás del otro, sin perder unidades.
   * Crea en 0 los que aún no existen.
   */
  async lockLevels(tenantId: number, locationId: number, itemIds: number[], tx: Tx): Promise<Map<number, LevelRow>> {
    await tx
      .insert(inventoryLevels)
      .values(itemIds.map((inventoryItemId) => ({ tenantId, locationId, inventoryItemId })))
      .onConflictDoNothing();
    const rows = await tx
      .select()
      .from(inventoryLevels)
      .where(
        and(
          eq(inventoryLevels.tenantId, tenantId),
          eq(inventoryLevels.locationId, locationId),
          inArray(inventoryLevels.inventoryItemId, itemIds),
        ),
      )
      .orderBy(asc(inventoryLevels.inventoryItemId)) // mismo orden de bloqueo en todas las transacciones: sin deadlocks
      .for('update');
    return new Map(rows.map((r) => [r.inventoryItemId, r]));
  }

  /** Suma `delta` a disponible y físico (un ajuste de "available" mueve también el on_hand, como en Shopify). */
  async applyAvailableDelta(tenantId: number, locationId: number, itemId: number, delta: number, tx: Tx) {
    const [row] = await tx
      .update(inventoryLevels)
      .set({
        available: sql`${inventoryLevels.available} + ${delta}`,
        onHand: sql`${inventoryLevels.onHand} + ${delta}`,
      })
      .where(
        and(
          eq(inventoryLevels.tenantId, tenantId),
          eq(inventoryLevels.locationId, locationId),
          eq(inventoryLevels.inventoryItemId, itemId),
        ),
      )
      .returning({ available: inventoryLevels.available, onHand: inventoryLevels.onHand });
    return row;
  }

  async insertAdjustments(rows: (typeof inventoryAdjustments.$inferInsert)[], tx: Tx): Promise<void> {
    if (rows.length > 0) await tx.insert(inventoryAdjustments).values(rows);
  }

  /** Kardex paginado (más reciente primero), con nombres de producto, bodega y usuario. */
  async adjustmentsPage(tenantId: number, query: AdjustmentsQuery, tx: Executor = this.db) {
    const filters = [eq(inventoryAdjustments.tenantId, tenantId)];
    if (query.locationId) filters.push(eq(inventoryAdjustments.locationId, query.locationId));
    if (query.inventoryItemId) filters.push(eq(inventoryAdjustments.inventoryItemId, query.inventoryItemId));
    if (query.q) {
      const pattern = likePattern(query.q);
      filters.push(or(ilike(products.title, pattern), ilike(productVariants.title, pattern), ilike(productVariants.sku, pattern))!);
    }
    const where = and(...filters);

    const [items, [{ total: rows }]] = await Promise.all([
      tx
        .select({
          id: inventoryAdjustments.id,
          createdAt: inventoryAdjustments.createdAt,
          inventoryItemId: inventoryAdjustments.inventoryItemId,
          productTitle: products.title,
          variantTitle: productVariants.title,
          sku: productVariants.sku,
          locationId: locations.id,
          locationName: locations.name,
          locationCode: locations.code,
          delta: inventoryAdjustments.delta,
          quantityAfter: inventoryAdjustments.quantityAfter,
          reason: inventoryAdjustments.reason,
          note: inventoryAdjustments.note,
          source: inventoryAdjustments.source,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(inventoryAdjustments)
        .innerJoin(productVariants, eq(productVariants.inventoryItemId, inventoryAdjustments.inventoryItemId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(locations, eq(locations.id, inventoryAdjustments.locationId))
        .leftJoin(users, eq(users.id, inventoryAdjustments.userId))
        .where(where)
        .orderBy(desc(inventoryAdjustments.createdAt), desc(inventoryAdjustments.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx
        .select({ total: count() })
        .from(inventoryAdjustments)
        .innerJoin(productVariants, eq(productVariants.inventoryItemId, inventoryAdjustments.inventoryItemId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(where),
    ]);
    return { items, total: rows };
  }

  /** De las bodegas indicadas, las vigentes y activas de la empresa. */
  async activeLocationIds(tenantId: number, locationIds: number[], tx: Executor = this.db): Promise<Set<number>> {
    if (locationIds.length === 0) return new Set();
    const rows = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.tenantId, tenantId), inArray(locations.id, locationIds), isNull(locations.deletedAt), eq(locations.isActive, true)),
      );
    return new Set(rows.map((r) => r.id));
  }

  /** De los ítems indicados, los que ya tienen nivel (fila de stock) en la bodega. */
  async existingLevelIds(tenantId: number, locationId: number, itemIds: number[], tx: Executor = this.db): Promise<Set<number>> {
    if (itemIds.length === 0) return new Set();
    const rows = await tx
      .select({ id: inventoryLevels.inventoryItemId })
      .from(inventoryLevels)
      .where(
        and(
          eq(inventoryLevels.tenantId, tenantId),
          eq(inventoryLevels.locationId, locationId),
          inArray(inventoryLevels.inventoryItemId, itemIds),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  /** Crea niveles con stock inicial (ítems recién creados: aún no tienen niveles). */
  async insertLevels(rows: { tenantId: number; inventoryItemId: number; locationId: number; quantity: number }[], tx: Tx) {
    if (rows.length === 0) return;
    await tx
      .insert(inventoryLevels)
      .values(rows.map(({ quantity, ...r }) => ({ ...r, available: quantity, onHand: quantity })));
  }

  /** Disponible por bodega (vigente) de cada ítem. */
  async levelsByItem(tenantId: number, itemIds: number[], tx: Executor = this.db) {
    if (itemIds.length === 0) return [];
    return tx
      .select({ itemId: inventoryLevels.inventoryItemId, locationId: inventoryLevels.locationId, available: inventoryLevels.available })
      .from(inventoryLevels)
      .innerJoin(locations, eq(locations.id, inventoryLevels.locationId))
      .where(and(eq(inventoryLevels.tenantId, tenantId), inArray(inventoryLevels.inventoryItemId, itemIds), isNull(locations.deletedAt)))
      .orderBy(asc(locations.name), asc(locations.id));
  }
}
