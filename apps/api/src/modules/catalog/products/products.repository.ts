import { Inject, Injectable } from '@nestjs/common';
import { likePattern, type ProductsQuery } from '@erp/contracts';
import { and, asc, count, desc, eq, ilike, inArray, isNull, like, max, min, ne, or, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { inventoryItems } from '../../inventory/infrastructure/persistence/inventory.schema.js';
import { shops } from '../../shops/shops.schema.js';
import { shopifyResourceLinks } from '../../sync/infrastructure/persistence/sync.schema.js';
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

  /**
   * Productos vigentes de la empresa, con estado, búsqueda (título, marca, tipo, SKU o código de barras)
   * y tienda (shopId: los vinculados a esa tienda de Shopify o importados desde ella).
   */
  private filter(tenantId: number, query?: Pick<ProductsQuery, 'q' | 'status'>, shopId?: number) {
    const filters = [eq(products.tenantId, tenantId), isNull(products.deletedAt)];
    if (query?.status) filters.push(eq(products.status, query.status));
    if (shopId) {
      filters.push(
        or(
          eq(products.originShopId, shopId),
          sql`exists (
            select 1 from shopify_resource_links l
            where l.erp_id = "products"."id" and l.resource_type = 'PRODUCT' and l.shop_id = ${shopId} and l.unlinked_at is null)`,
        )!,
      );
    }
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

  async listPage(tenantId: number, query: ProductsQuery, shopId?: number, tx: Executor = this.db) {
    const where = this.filter(tenantId, query, shopId);
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
          // Subconsultas con columnas calificadas a mano ("products"."id"): ver nota en filter().
          featuredMediaId: sql<number | null>`(
            select pm.media_id from product_media pm
            where pm.product_id = "products"."id" order by pm.position limit 1
          )::bigint`.mapWith(Number),
          trackedVariants: sql<number>`(
            select count(*) from product_variants pv
            join inventory_items ii on ii.id = pv.inventory_item_id
            where pv.product_id = "products"."id" and pv.deleted_at is null and ii.tracked
          )::int`,
          available: sql<number>`(
            select coalesce(sum(il.available), 0) from product_variants pv
            join inventory_items ii on ii.id = pv.inventory_item_id
            join inventory_levels il on il.inventory_item_id = ii.id
            join locations l on l.id = il.location_id
            where pv.product_id = "products"."id" and pv.deleted_at is null and ii.tracked and l.deleted_at is null
          )::int`,
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

  /** Id de una tienda de la empresa por su handle (undefined si no existe). */
  async shopIdByHandle(tenantId: number, handle: string, tx: Executor = this.db): Promise<number | undefined> {
    const [row] = await tx
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), eq(shops.handle, handle)))
      .limit(1);
    return row?.id;
  }

  /**
   * Tiendas de cada producto: las vinculadas en Shopify y la tienda desde la que se importó.
   * onlyShopIds restringe a las que el usuario puede ver (null = todas).
   */
  async shopsOf(
    tenantId: number,
    productIds: number[],
    onlyShopIds: number[] | null,
    tx: Executor = this.db,
  ): Promise<Map<number, { id: number; name: string }[]>> {
    const result = new Map<number, { id: number; name: string }[]>(productIds.map((id) => [id, []]));
    if (productIds.length === 0) return result;
    const visible = onlyShopIds ? inArray(shops.id, onlyShopIds.length > 0 ? onlyShopIds : [-1]) : undefined;
    const [linked, origin] = await Promise.all([
      tx
        .select({ productId: shopifyResourceLinks.erpId, id: shops.id, name: shops.name })
        .from(shopifyResourceLinks)
        .innerJoin(shops, eq(shops.id, shopifyResourceLinks.shopId))
        .where(
          and(
            eq(shopifyResourceLinks.tenantId, tenantId),
            eq(shopifyResourceLinks.resourceType, 'PRODUCT'),
            inArray(shopifyResourceLinks.erpId, productIds),
            isNull(shopifyResourceLinks.unlinkedAt),
            visible,
          ),
        ),
      tx
        .select({ productId: products.id, id: shops.id, name: shops.name })
        .from(products)
        .innerJoin(shops, eq(shops.id, products.originShopId))
        .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds), visible)),
    ]);
    for (const row of [...linked, ...origin]) {
      const list = result.get(row.productId);
      if (list && !list.some((s) => s.id === row.id)) list.push({ id: row.id, name: row.name });
    }
    for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return result;
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
  ): Promise<{ variantId: number; inventoryItemId: number }> {
    const [created] = await tx
      .insert(inventoryItems)
      .values({ tenantId, ...item })
      .returning({ id: inventoryItems.id });
    const [row] = await tx
      .insert(productVariants)
      .values({ tenantId, productId, inventoryItemId: created.id, ...variant })
      .returning({ id: productVariants.id });
    return { variantId: row.id, inventoryItemId: created.id };
  }

  /** Cambia el estado de varios productos vigentes de la empresa; devuelve los afectados. */
  async setStatus(tenantId: number, ids: number[], status: string, tx: Executor): Promise<number[]> {
    const rows = await tx
      .update(products)
      .set({ status, version: sql`${products.version} + 1` })
      .where(and(this.filter(tenantId), inArray(products.id, ids)))
      .returning({ id: products.id });
    return rows.map((r) => r.id);
  }

  /** Productos vigentes de la empresa entre los indicados. */
  async existingIds(tenantId: number, ids: number[], tx: Executor = this.db): Promise<number[]> {
    const rows = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(this.filter(tenantId), inArray(products.id, ids)));
    return rows.map((r) => r.id);
  }

  /** Tipos, proveedores y etiquetas ya usados en el catálogo (sugerencias del formulario). */
  async facets(tenantId: number, tx: Executor = this.db) {
    const active = this.filter(tenantId);
    const [types, vendors, tags] = await Promise.all([
      tx
        .selectDistinct({ value: products.productType })
        .from(products)
        .where(and(active, sql`${products.productType} is not null`))
        .orderBy(asc(products.productType))
        .limit(200),
      tx
        .selectDistinct({ value: products.vendor })
        .from(products)
        .where(and(active, sql`${products.vendor} is not null`))
        .orderBy(asc(products.vendor))
        .limit(200),
      tx
        .selectDistinct({ value: sql<string>`unnest(${products.tags})` })
        .from(products)
        .where(active)
        .orderBy(sql`1`)
        .limit(500),
    ]);
    const values = (rows: { value: string | null }[]) => rows.flatMap((r) => (r.value ? [r.value] : []));
    return { productTypes: values(types), vendors: values(vendors), tags: values(tags) };
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
