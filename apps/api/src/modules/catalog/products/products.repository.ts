import { Inject, Injectable } from '@nestjs/common';
import { likePattern, type ProductsQuery } from '@erp/contracts';
import { and, asc, count, desc, eq, ilike, inArray, isNull, like, max, min, ne, or, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { inventoryItems } from '../../inventory/infrastructure/persistence/inventory.schema.js';
import {
  productOptions,
  productOptionValues,
  products,
  productVariants,
  variantOptionValues,
} from '../infrastructure/persistence/catalog.schema.js';

type Executor = Database | Tx;
export type ProductRow = typeof products.$inferSelect;
export type InventoryItemValues = Omit<typeof inventoryItems.$inferInsert, 'id' | 'tenantId'>;
export type VariantValues = Omit<typeof productVariants.$inferInsert, 'id' | 'tenantId' | 'productId' | 'inventoryItemId'>;

@Injectable()
export class ProductsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Productos vigentes de la empresa, con estado y búsqueda (título, marca, tipo, SKU o código de barras). */
  private filter(tenantId: number, query?: Pick<ProductsQuery, 'q' | 'status'>) {
    const filters = [eq(products.tenantId, tenantId), isNull(products.deletedAt)];
    if (query?.status) filters.push(eq(products.status, query.status));
    if (query?.q) {
      const pattern = likePattern(query.q);
      // "products"."id" escrito a mano: sin JOIN, Drizzle no califica la columna y dentro de la
      // subconsulta "id" apuntaría a product_variants.
      const variantMatch = sql`exists (
        select 1 from product_variants pv
        where pv.product_id = "products"."id" and pv.deleted_at is null
          and (pv.sku ilike ${pattern} or pv.barcode ilike ${pattern}))`;
      filters.push(
        or(ilike(products.title, pattern), ilike(products.vendor, pattern), ilike(products.productType, pattern), variantMatch)!,
      );
    }
    return and(...filters);
  }

  async listPage(tenantId: number, query: ProductsQuery, tx: Executor = this.db) {
    const where = this.filter(tenantId, query);
    const [items, [{ total }]] = await Promise.all([
      tx
        .select({
          id: products.id,
          title: products.title,
          handle: products.handle,
          status: products.status,
          vendor: products.vendor,
          productType: products.productType,
          updatedAt: products.updatedAt,
          variantsCount: count(productVariants.id),
          minPrice: min(productVariants.basePrice),
          maxPrice: max(productVariants.basePrice),
        })
        .from(products)
        .leftJoin(productVariants, and(eq(productVariants.productId, products.id), isNull(productVariants.deletedAt)))
        .where(where)
        .groupBy(products.id)
        .orderBy(desc(products.updatedAt), desc(products.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(products).where(where),
    ]);
    return { items, total };
  }

  async findById(tenantId: number, productId: number, tx: Executor = this.db): Promise<ProductRow | undefined> {
    const [row] = await tx
      .select()
      .from(products)
      .where(and(this.filter(tenantId), eq(products.id, productId)))
      .limit(1);
    return row;
  }

  /** Opciones (con sus valores) y variantes vigentes (con su ítem de inventario) de un producto. */
  async loadDetail(tenantId: number, productId: number, tx: Executor = this.db) {
    const [options, values, variants] = await Promise.all([
      tx
        .select({ id: productOptions.id, name: productOptions.name })
        .from(productOptions)
        .where(and(eq(productOptions.tenantId, tenantId), eq(productOptions.productId, productId)))
        .orderBy(asc(productOptions.position)),
      tx
        .select({ id: productOptionValues.id, optionId: productOptionValues.optionId, name: productOptionValues.name })
        .from(productOptionValues)
        .where(and(eq(productOptionValues.tenantId, tenantId), eq(productOptionValues.productId, productId)))
        .orderBy(asc(productOptionValues.position)),
      tx
        .select({ variant: productVariants, item: inventoryItems })
        .from(productVariants)
        .innerJoin(inventoryItems, eq(inventoryItems.id, productVariants.inventoryItemId))
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.productId, productId),
            isNull(productVariants.deletedAt),
          ),
        )
        .orderBy(asc(productVariants.position), asc(productVariants.id)),
    ]);
    const variantIds = variants.map((v) => v.variant.id);
    const links =
      variantIds.length === 0
        ? []
        : await tx
            .select({ variantId: variantOptionValues.variantId, optionValueId: variantOptionValues.optionValueId })
            .from(variantOptionValues)
            .where(and(eq(variantOptionValues.tenantId, tenantId), inArray(variantOptionValues.variantId, variantIds)));
    return { options, values, variants, links };
  }

  /** Handles ocupados por productos vigentes que empiezan como `base`. */
  async takenHandles(tenantId: number, base: string, tx: Executor = this.db): Promise<Set<string>> {
    const rows = await tx
      .select({ handle: products.handle })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          isNull(products.deletedAt),
          or(eq(products.handle, base), like(products.handle, `${base}-%`)),
        ),
      );
    return new Set(rows.map((r) => r.handle));
  }

  async insertProduct(values: typeof products.$inferInsert, tx: Executor): Promise<ProductRow> {
    const [row] = await tx.insert(products).values(values).returning();
    return row;
  }

  /** Actualiza solo si nadie lo cambió desde `version` (concurrencia optimista). */
  async updateProduct(
    tenantId: number,
    productId: number,
    version: number | undefined,
    values: Partial<typeof products.$inferInsert>,
    tx: Executor,
  ): Promise<ProductRow | undefined> {
    const filters = [this.filter(tenantId), eq(products.id, productId)];
    if (version !== undefined) filters.push(eq(products.version, version));
    const [row] = await tx
      .update(products)
      .set({ ...values, version: sql`${products.version} + 1` })
      .where(and(...filters))
      .returning();
    return row;
  }

  async softDeleteProduct(tenantId: number, productId: number, tx: Executor): Promise<void> {
    const now = new Date();
    await tx
      .update(products)
      .set({ deletedAt: now })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
    await tx
      .update(productVariants)
      .set({ deletedAt: now })
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, productId), isNull(productVariants.deletedAt)));
  }

  /**
   * Reemplaza opciones y valores del producto. Devuelve, por opción (en orden), el id de cada valor
   * por su nombre en minúsculas. Las relaciones variante-valor anteriores caen en cascada.
   */
  async replaceOptions(
    tenantId: number,
    productId: number,
    options: { name: string; values: { name: string; hasVariants: boolean }[] }[],
    tx: Executor,
  ): Promise<Map<string, number>[]> {
    await tx.delete(productOptions).where(and(eq(productOptions.tenantId, tenantId), eq(productOptions.productId, productId)));
    const result: Map<string, number>[] = [];
    for (const [index, option] of options.entries()) {
      const [created] = await tx
        .insert(productOptions)
        .values({ tenantId, productId, name: option.name, position: index + 1 })
        .returning({ id: productOptions.id });
      const rows = await tx
        .insert(productOptionValues)
        .values(
          option.values.map((value, i) => ({
            tenantId,
            productId,
            optionId: created.id,
            name: value.name,
            position: i + 1,
            hasVariants: value.hasVariants,
          })),
        )
        .returning({ id: productOptionValues.id, name: productOptionValues.name });
      result.push(new Map(rows.map((r) => [r.name.toLowerCase(), r.id])));
    }
    return result;
  }

  /** Variantes vigentes del producto (id e ítem de inventario). */
  activeVariants(tenantId: number, productId: number, tx: Executor) {
    return tx
      .select({ id: productVariants.id, inventoryItemId: productVariants.inventoryItemId })
      .from(productVariants)
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, productId), isNull(productVariants.deletedAt)));
  }

  /** Baja lógica de variantes (su ítem de inventario se conserva para el historial). */
  async softDeleteVariants(tenantId: number, variantIds: number[], tx: Executor): Promise<void> {
    if (variantIds.length === 0) return;
    await tx
      .update(productVariants)
      .set({ deletedAt: new Date() })
      .where(and(eq(productVariants.tenantId, tenantId), inArray(productVariants.id, variantIds)));
  }

  /** Libera los SKU de las variantes antes de reasignarlos (permite intercambiar SKUs entre variantes). */
  async clearSkus(tenantId: number, variantIds: number[], tx: Executor): Promise<void> {
    if (variantIds.length === 0) return;
    await tx
      .update(productVariants)
      .set({ sku: null })
      .where(and(eq(productVariants.tenantId, tenantId), inArray(productVariants.id, variantIds)));
  }

  /** SKUs (sin distinguir mayúsculas) ya usados por variantes vigentes de OTROS productos. */
  async skuConflicts(tenantId: number, skus: string[], productId: number | null, tx: Executor = this.db) {
    if (skus.length === 0) return [];
    const filters = [
      eq(productVariants.tenantId, tenantId),
      isNull(productVariants.deletedAt),
      inArray(sql`lower(${productVariants.sku})`, skus.map((s) => s.toLowerCase())),
    ];
    if (productId !== null) filters.push(ne(productVariants.productId, productId));
    return tx
      .select({ sku: productVariants.sku, productTitle: products.title })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(...filters));
  }

  async insertVariant(
    tenantId: number,
    productId: number,
    variant: VariantValues,
    item: InventoryItemValues,
    tx: Executor,
  ): Promise<number> {
    const [created] = await tx
      .insert(inventoryItems)
      .values({ tenantId, ...item })
      .returning({ id: inventoryItems.id });
    const [row] = await tx
      .insert(productVariants)
      .values({ tenantId, productId, inventoryItemId: created.id, ...variant })
      .returning({ id: productVariants.id });
    return row.id;
  }

  async updateVariant(
    tenantId: number,
    variantId: number,
    inventoryItemId: number,
    variant: VariantValues,
    item: InventoryItemValues,
    tx: Executor,
  ): Promise<void> {
    await tx
      .update(productVariants)
      .set({ ...variant, version: sql`${productVariants.version} + 1` })
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, variantId)));
    await tx
      .update(inventoryItems)
      .set({ ...item, version: sql`${inventoryItems.version} + 1` })
      .where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.id, inventoryItemId)));
  }

  async linkOptionValues(tenantId: number, links: { variantId: number; optionValueId: number }[], tx: Executor) {
    if (links.length === 0) return;
    await tx.insert(variantOptionValues).values(links.map((l) => ({ tenantId, ...l })));
  }
}
