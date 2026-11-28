import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_VARIANT_TITLE,
  type InventoryPolicy,
  type Paginated,
  paginated,
  type ProductBulkAction,
  type ProductBulkData,
  type ProductBulkResponse,
  type ProductData,
  type ProductFacetsResponse,
  type ProductListItem,
  type ProductResponse,
  type ProductsQuery,
  type ProductStatus,
  type WeightUnit,
} from '@erp/contracts';
import type { Tx } from '../../../shared/database/database.module.js';
import { isUniqueViolation } from '../../../shared/database/pg-errors.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { type AuditSource, AuditService } from '../../audit/audit.service.js';
import { nextAvailableSlug, slugify } from '../../identity/slug.js';
import { StockService } from '../../inventory/stock/stock.service.js';
import { MediaService, mediaUrl } from '../media/media.service.js';
import { sanitizeDescription } from './sanitize-description.js';
import { type ProductRow, ProductsRepository } from './products.repository.js';
import { TaxonomyService } from '../taxonomy/taxonomy.service.js';
import { TenantCurrencyReader } from './tenant-currency.reader.js';

const BULK_STATUS: Record<Exclude<ProductBulkAction, 'delete'>, ProductStatus> = { activate: 'ACTIVE', draft: 'DRAFT', archive: 'ARCHIVED' };
export const HANDLE_TAKEN = 'Ya existe un producto con esa URL';

/** Quién guarda: un usuario en el ERP (por defecto) o la importación desde una tienda. */
export type SaveOptions = { source?: AuditSource; shopId?: number };
const STALE ='Otra persona modificó este producto mientras lo editabas. Recarga la página para ver sus cambios.';

@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    private readonly currency: TenantCurrencyReader,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly media: MediaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async list(tenant: TenantContext, query: ProductsQuery): Promise<Paginated<ProductListItem>> {
    // Una tienda: solo sus productos. Que no exista o el usuario no tenga acceso = 404 (no se revela).
    let shopId: number | undefined;
    if (query.shop) {
      shopId = await this.repo.shopIdByHandle(tenant.tenantId, query.shop);
      if (!shopId || (tenant.allowedShopIds && !tenant.allowedShopIds.includes(shopId))) {
        throw new NotFoundException('Tienda no encontrada');
      }
    }
    const [{ items, total }, currency] = await Promise.all([
      this.repo.listPage(tenant.tenantId, query, shopId),
      this.currency.of(tenant.tenantId),
    ]);
    const shopsOf = await this.repo.shopsOf(
      tenant.tenantId,
      items.map((p) => p.id),
      tenant.allowedShopIds,
    );
    return paginated(
      items.map(({ featuredMediaId, ...row }) => ({
        ...row,
        shops: shopsOf.get(row.id) ?? [],
        imageUrl: featuredMediaId ? mediaUrl(tenant.slug, featuredMediaId) : null,
        status: row.status as ProductStatus,
        minPrice: row.minPrice ? trimDecimal(row.minPrice) : null,
        maxPrice: row.maxPrice ? trimDecimal(row.maxPrice) : null,
        currency,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async get(tenant: TenantContext, productId: number): Promise<ProductResponse> {
    return this.detail(tenant, await this.findOrFail(tenant, productId));
  }

  async create(tenant: TenantContext, userId: number, input: ProductData, options: SaveOptions = {}): Promise<ProductResponse> {
    await this.assertSkusFree(tenant.tenantId, input, null);
    const categoryGid = await this.taxonomy.resolve(input.categoryId);
    const currency = await this.currency.of(tenant.tenantId);
    const product = await this.guard(() =>
      this.repo.transaction(async (tx) => {
        let handle: string;
        if (input.handle) {
          // URL elegida a mano: si está ocupada se avisa (no se le agrega "-2" en silencio).
          if ((await this.repo.takenHandles(tenant.tenantId, input.handle, tx)).has(input.handle)) throw new ConflictException(HANDLE_TAKEN);
          handle = input.handle;
        } else {
          const base = slugify(input.title);
          handle = nextAvailableSlug(base, await this.repo.takenHandles(tenant.tenantId, base, tx));
        }
        const created = await this.repo.insertProduct(
          { tenantId: tenant.tenantId, handle, originShopId: options.shopId ?? null, ...productColumns(input), categoryGid },
          tx,
        );
        await this.saveVariants(tx, tenant.tenantId, userId, created.id, input, currency, true);
        await this.media.setProductMedia(tenant.tenantId, created.id, input.media, tx);
        await this.record(tx, tenant, userId, created.id, 'CREATE', { new: summary(input) }, options);
        return created;
      }),
    );
    return this.detail(tenant, product);
  }

  /** Guarda el producto completo (datos, opciones y variantes). Las variantes con id se conservan. */
  async update(
    tenant: TenantContext,
    userId: number,
    productId: number,
    input: ProductData,
    options: SaveOptions = {},
  ): Promise<ProductResponse> {
    const current = await this.findOrFail(tenant, productId);
    if (input.version !== undefined && input.version !== current.version) throw new ConflictException(STALE);
    await this.assertSkusFree(tenant.tenantId, input, productId);
    const categoryGid = await this.taxonomy.resolve(input.categoryId);
    const currency = await this.currency.of(tenant.tenantId);
    const product = await this.guard(() =>
      this.repo.transaction(async (tx) => {
        // Renombrar no cambia la URL (no se rompen los enlaces); solo cambia si se edita a mano.
        const columns: Parameters<ProductsRepository['updateProduct']>[3] = { ...productColumns(input), categoryGid };
        if (input.handle && input.handle !== current.handle) {
          if ((await this.repo.takenHandles(tenant.tenantId, input.handle, tx)).has(input.handle)) throw new ConflictException(HANDLE_TAKEN);
          columns.handle = input.handle;
        }
        const updated = await this.repo.updateProduct(tenant.tenantId, productId, input.version, columns, tx);
        if (!updated) throw new ConflictException(STALE);
        await this.saveVariants(tx, tenant.tenantId, userId, productId, input, currency, false);
        await this.media.setProductMedia(tenant.tenantId, productId, input.media, tx);
        await this.record(tx, tenant, userId, productId, 'UPDATE', {
          old: { title: current.title, status: current.status },
          new: summary(input),
        }, options);
        return updated;
      }),
    );
    return this.detail(tenant, product);
  }

  /** Baja lógica del producto y sus variantes (los ítems de inventario se conservan). */
  async remove(tenant: TenantContext, userId: number, productId: number): Promise<void> {
    const product = await this.findOrFail(tenant, productId);
    await this.repo.transaction(async (tx) => {
      await this.repo.softDeleteProduct(tenant.tenantId, productId, tx);
      await this.record(tx, tenant, userId, productId, 'DELETE', { old: { title: product.title, handle: product.handle } });
    });
  }

  /** Acción en bloque desde la lista (activar, borrador, archivar o eliminar varios). */
  async bulk(tenant: TenantContext, userId: number, input: ProductBulkData): Promise<ProductBulkResponse> {
    return this.repo.transaction(async (tx) => {
      let affected: number[];
      if (input.action === 'delete') {
        affected = await this.repo.existingIds(tenant.tenantId, input.ids, tx);
        for (const id of affected) await this.repo.softDeleteProduct(tenant.tenantId, id, tx);
      } else {
        affected = await this.repo.setStatus(tenant.tenantId, input.ids, BULK_STATUS[input.action], tx);
      }
      for (const id of affected) {
        await this.record(tx, tenant, userId, id, input.action === 'delete' ? 'DELETE' : 'UPDATE', { bulk: input.action });
      }
      return { affected: affected.length };
    });
  }

  facets(tenant: TenantContext): Promise<ProductFacetsResponse> {
    return this.repo.facets(tenant.tenantId);
  }

  // ---------- internos ----------

  private async saveVariants(
    tx: Tx,
    tenantId: number,
    userId: number,
    productId: number,
    input: ProductData,
    currency: string,
    isNew: boolean,
  ) {
    const { options, variants } = input;

    // Valor canónico (como se escribió en la opción) de cada valor elegido por una variante.
    const canonical = variants.map((v) =>
      v.optionValues.map((value, i) => options[i].values.find((o) => o.toLowerCase() === value.toLowerCase())!),
    );
    const used = options.map((_, i) => new Set(canonical.map((values) => values[i].toLowerCase())));
    const valueIds = await this.repo.replaceOptions(
      tenantId,
      productId,
      options.map((option, i) => ({
        name: option.name,
        values: option.values.map((name) => ({ name, hasVariants: used[i].has(name.toLowerCase()) })),
      })),
      tx,
    );

    const existing = isNew ? [] : await this.repo.activeVariants(tenantId, productId, tx);
    const byId = new Map(existing.map((v) => [v.id, v]));
    const keptIds = variants.flatMap((v) => (v.id ? [v.id] : []));
    if (keptIds.some((id) => !byId.has(id))) {
      throw new BadRequestException('Alguna variante no pertenece a este producto (recarga la página)');
    }
    await this.repo.softDeleteVariants(
      tenantId,
      existing.filter((v) => !keptIds.includes(v.id)).map((v) => v.id),
      tx,
    );
    await this.repo.clearSkus(tenantId, keptIds, tx);

    const links: { variantId: number; optionValueId: number }[] = [];
    const initialStock: { inventoryItemId: number; locationId: number; quantity: number }[] = [];
    for (const [index, variant] of variants.entries()) {
      const title = options.length > 0 ? canonical[index].join(' / ') : DEFAULT_VARIANT_TITLE;
      const variantValues = {
        title,
        displayName: options.length > 0 ? `${input.title} - ${title}` : input.title,
        sku: variant.sku,
        barcode: variant.barcode,
        basePrice: variant.price,
        compareAtPrice: variant.compareAtPrice,
        basePriceCurrency: currency,
        inventoryPolicy: variant.inventoryPolicy,
        position: index + 1,
        taxable: variant.taxable,
        deletedAt: null,
      };
      const itemValues = {
        sku: variant.sku,
        tracked: variant.tracked,
        requiresShipping: variant.requiresShipping,
        unitCost: variant.cost,
        unitCostCurrency: variant.cost ? currency : null,
        weightValue: variant.weight,
        weightUnit: variant.weightUnit,
        countryCodeOfOrigin: variant.countryCodeOfOrigin,
        harmonizedSystemCode: variant.harmonizedSystemCode,
      };
      let variantId: number;
      if (variant.id) {
        variantId = variant.id;
        await this.repo.updateVariant(tenantId, variantId, byId.get(variantId)!.inventoryItemId, variantValues, itemValues, tx);
      } else {
        const created = await this.repo.insertVariant(tenantId, productId, variantValues, itemValues, tx);
        variantId = created.variantId;
        // Stock inicial por bodega: solo variantes nuevas (el de las existentes se ajusta en Inventario).
        for (const q of variant.quantities) initialStock.push({ inventoryItemId: created.inventoryItemId, ...q });
      }
      canonical[index].forEach((value, i) => links.push({ variantId, optionValueId: valueIds[i].get(value.toLowerCase())! }));
    }
    await this.repo.linkOptionValues(tenantId, links, tx);
    await this.stock.seedInitialStock(tenantId, userId, initialStock, tx);
  }

  /** Mensaje claro si un SKU ya lo usa otro producto (el índice único es la garantía final). */
  private async assertSkusFree(tenantId: number, input: ProductData, productId: number | null) {
    const skus = input.variants.flatMap((v) => (v.sku ? [v.sku] : []));
    const [conflict] = await this.repo.skuConflicts(tenantId, skus, productId);
    if (conflict) throw new ConflictException(`El SKU "${conflict.sku}" ya lo usa el producto "${conflict.productTitle}"`);
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isUniqueViolation(error, 'product_variants_tenant_sku_uq')) {
        throw new ConflictException('Alguno de los SKU ya lo usa otro producto');
      }
      if (isUniqueViolation(error, 'products_tenant_handle_uq')) {
        throw new ConflictException('Se creó otro producto con un título equivalente al mismo tiempo. Intenta nuevamente.');
      }
      throw error;
    }
  }

  private async findOrFail(tenant: TenantContext, productId: number): Promise<ProductRow> {
    const row = await this.repo.findById(tenant.tenantId, productId);
    if (!row) throw new NotFoundException('Producto no encontrado');
    return row;
  }

  private async detail(tenant: TenantContext, product: ProductRow): Promise<ProductResponse> {
    const [{ options, values, variants, links }, currency, media, categories] = await Promise.all([
      this.repo.loadDetail(tenant.tenantId, product.id),
      this.currency.of(tenant.tenantId),
      this.media.productMedia(tenant, product.id),
      this.taxonomy.byIds(product.categoryGid ? [product.categoryGid] : []),
    ]);
    const levels = await this.stock.levelsByItem(
      tenant.tenantId,
      variants.map(({ item }) => item.id),
    );
    const valueById = new Map(values.map((v) => [v.id, v]));
    const valuesOf = (variantId: number) => {
      const chosen = links.filter((l) => l.variantId === variantId).map((l) => valueById.get(l.optionValueId)!);
      return options.map((o) => chosen.find((v) => v.optionId === o.id)?.name ?? '');
    };
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      category: (product.categoryGid && categories.get(product.categoryGid)) || null,
      status: product.status as ProductStatus,
      tags: product.tags,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      options: options.map((o) => ({ name: o.name, values: values.filter((v) => v.optionId === o.id).map((v) => v.name) })),
      media,
      variants: variants.map(({ variant, item }) => ({
        id: variant.id,
        title: variant.title,
        optionValues: valuesOf(variant.id),
        sku: variant.sku,
        barcode: variant.barcode,
        price: trimDecimal(variant.basePrice ?? '0'),
        compareAtPrice: variant.compareAtPrice ? trimDecimal(variant.compareAtPrice) : null,
        inventoryPolicy: variant.inventoryPolicy as InventoryPolicy,
        cost: item.unitCost ? trimDecimal(item.unitCost) : null,
        tracked: item.tracked,
        requiresShipping: item.requiresShipping,
        taxable: variant.taxable,
        weight: item.weightValue ? trimDecimal(item.weightValue) : null,
        weightUnit: (item.weightUnit ?? 'KILOGRAMS') as WeightUnit,
        countryCodeOfOrigin: item.countryCodeOfOrigin,
        harmonizedSystemCode: item.harmonizedSystemCode,
        inventoryItemId: item.id,
        available: (levels.get(item.id) ?? []).reduce((acc, l) => acc + l.available, 0),
        levels: levels.get(item.id) ?? [],
      })),
      currency,
      version: product.version,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private record(
    tx: Tx,
    tenant: TenantContext,
    userId: number,
    productId: number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    changes: Record<string, unknown>,
    options: SaveOptions = {},
  ) {
    return this.audit.record(
      {
        tenantId: tenant.tenantId,
        shopId: options.shopId ?? null,
        userId,
        source: options.source ?? 'ERP_USER',
        entityType: 'Product',
        entityId: productId,
        action,
        changes,
      },
      tx,
    );
  }
}

function productColumns(input: ProductData) {
  return {
    title: input.title,
    // HTML del editor, limpiado: solo formato (sin scripts, eventos ni enlaces javascript:).
    descriptionHtml: sanitizeDescription(input.description),
    vendor: input.vendor,
    productType: input.productType,
    status: input.status,
    tags: input.tags,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };
}

function summary(input: ProductData) {
  return { title: input.title, status: input.status, categoryId: input.categoryId, options: input.options.map((o) => o.name), variants: input.variants.length };
}

/** numeric(18,4) llega como "19.9000": se muestra "19.90" (o "20" si es entero). */
export function trimDecimal(value: string): string {
  const [int, frac = ''] = value.split('.');
  const trimmed = frac.replace(/0+$/, '');
  if (!trimmed) return int;
  return `${int}.${trimmed.length === 1 ? `${trimmed}0` : trimmed}`;
}
