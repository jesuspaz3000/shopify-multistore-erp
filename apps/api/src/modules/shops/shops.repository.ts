import { Inject, Injectable } from '@nestjs/common';
import { likePattern, type PaginationQuery } from '@erp/contracts';
import { and, asc, count, eq, ilike, inArray, like, or } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../shared/database/database.module.js';
import { shops } from './shops.schema.js';

type Executor = Database | Tx;
export type ShopRow = typeof shops.$inferSelect;

@Injectable()
export class ShopsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  private visibleFilter(tenantId: number, onlyIds: number[] | null, q?: string) {
    const filters = [eq(shops.tenantId, tenantId)];
    if (onlyIds) filters.push(inArray(shops.id, onlyIds.length > 0 ? onlyIds : [-1]));
    if (q) filters.push(or(ilike(shops.name, likePattern(q)), ilike(shops.handle, likePattern(q)))!);
    return and(...filters);
  }

  /** Página de tiendas de la empresa; `onlyIds` restringe a las permitidas al usuario (null = todas). */
  async listPage(tenantId: number, onlyIds: number[] | null, query: PaginationQuery, tx: Executor = this.db) {
    const where = this.visibleFilter(tenantId, onlyIds, query.q);
    const [items, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(shops)
        .where(where)
        .orderBy(asc(shops.name), asc(shops.id)) // id: orden estable entre páginas
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(shops).where(where),
    ]);
    return { items, total };
  }

  /** Todas las tiendas visibles, solo id/handle/nombre (selectores). */
  options(tenantId: number, onlyIds: number[] | null, tx: Executor = this.db) {
    return tx
      .select({ id: shops.id, handle: shops.handle, name: shops.name })
      .from(shops)
      .where(this.visibleFilter(tenantId, onlyIds))
      .orderBy(asc(shops.name), asc(shops.id));
  }

  async findById(tenantId: number, shopId: number, tx: Executor = this.db): Promise<ShopRow | undefined> {
    const [shop] = await tx
      .select()
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), eq(shops.id, shopId)))
      .limit(1);
    return shop;
  }

  /** Handles ocupados en la empresa que empiezan como `base`. */
  async takenHandles(tenantId: number, base: string, tx: Executor = this.db): Promise<Set<string>> {
    const rows = await tx
      .select({ handle: shops.handle })
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), or(eq(shops.handle, base), like(shops.handle, `${base}-%`))));
    return new Set(rows.map((r) => r.handle));
  }

  async insert(values: typeof shops.$inferInsert, tx: Executor = this.db): Promise<ShopRow> {
    const [shop] = await tx.insert(shops).values(values).returning();
    return shop;
  }

  async update(
    tenantId: number,
    shopId: number,
    values: Partial<typeof shops.$inferInsert>,
    tx: Executor = this.db,
  ): Promise<ShopRow | undefined> {
    const [shop] = await tx
      .update(shops)
      .set(values)
      .where(and(eq(shops.tenantId, tenantId), eq(shops.id, shopId)))
      .returning();
    return shop;
  }

  async delete(tenantId: number, shopId: number, tx: Executor = this.db): Promise<void> {
    await tx.delete(shops).where(and(eq(shops.tenantId, tenantId), eq(shops.id, shopId)));
  }
}
