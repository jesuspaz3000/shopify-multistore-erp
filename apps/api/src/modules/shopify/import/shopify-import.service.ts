import { BadRequestException, ConflictException, HttpException, Injectable, Logger } from '@nestjs/common';
import {
  MAX_IMPORT_WARNINGS,
  MEDIA_MAX_BYTES,
  type ProductResponse,
  productInputSchema,
  type ShopifyImportResponse,
  type ShopifyImportWarning,
} from '@erp/contracts';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { MediaService } from '../../catalog/media/media.service.js';
import { HANDLE_TAKEN, ProductsService } from '../../catalog/products/products.service.js';
import { TaxonomyService } from '../../catalog/taxonomy/taxonomy.service.js';
import { nextAvailableSlug, slugify } from '../../identity/slug.js';
import { StockService } from '../../inventory/stock/stock.service.js';
import { ShopsService } from '../../shops/shops.service.js';
import { ShopifyConnectionService } from '../shopify-connection.service.js';
import {
  LOCATION_LEVELS_QUERY,
  LOCATIONS_QUERY,
  type PageInfo,
  PRODUCT_IDS_QUERY,
  PRODUCT_QUERY,
  type ShopifyLocationNode,
} from './shopify-import.queries.js';
import { type LinkInput, ShopifyImportRepository } from './shopify-import.repository.js';
import { type ShopifyMediaNode, type ShopifyProductNode, type ShopifyVariantNode, toProductInput } from './shopify-product.mapper.js';

type ProductSummary = { id: string; title: string; updatedAt: string; category: { id: string } | null };
type ProductPayload = { product: (ShopifyProductNode & { variants: { pageInfo: PageInfo; nodes: ShopifyVariantNode[] } }) | null };

const IMAGE_TIMEOUT_MS = 30_000;
const legacyId = (gid: string) => {
  const n = Number(gid.split('/').pop());
  return Number.isSafeInteger(n) ? n : null;
};

/**
 * "Importar desde Shopify": trae a la empresa las ubicaciones (como bodegas), los productos (con
 * opciones, variantes e imágenes) y el stock disponible de una tienda conectada.
 * Es repetible: los vínculos por GID (shopify_resource_links) evitan duplicar; un producto que no
 * cambió en Shopify desde la última importación no se vuelve a escribir.
 */
@Injectable()
export class ShopifyImportService {
  private readonly logger = new Logger(ShopifyImportService.name);
  /** Tiendas importándose ahora (una importación por tienda a la vez). */
  private readonly running = new Set<number>();

  constructor(
    private readonly connection: ShopifyConnectionService,
    private readonly shops: ShopsService,
    private readonly products: ProductsService,
    private readonly media: MediaService,
    private readonly stock: StockService,
    private readonly repo: ShopifyImportRepository,
    private readonly audit: AuditService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async importShop(tenant: TenantContext, userId: number, shopId: number): Promise<ShopifyImportResponse> {
    const shop = await this.shops.findAccessible(tenant, shopId);
    if (shop.status !== 'installed') throw new ConflictException('La tienda no está conectada a Shopify');
    if (this.running.has(shopId)) throw new ConflictException('Ya se está importando esta tienda: espera a que termine');
    this.running.add(shopId);
    try {
      const warnings: ShopifyImportWarning[] = [];
      const warn = (product: string | null, message: string) => {
        if (warnings.length < MAX_IMPORT_WARNINGS) warnings.push({ product, message });
      };

      const { locationIds, ...locations } = await this.importLocations(tenant, userId, shopId);
      const products = await this.importProducts(tenant, userId, shopId, warn);
      const adjusted = await this.importStock(tenant, userId, shopId, locationIds);

      const result: ShopifyImportResponse = { locations, products, stock: { adjusted }, warnings };
      await this.audit.record({
        tenantId: tenant.tenantId,
        shopId,
        userId,
        source: 'SHOPIFY_SYNC',
        entityType: 'Shop',
        entityId: shopId,
        action: 'SHOPIFY_IMPORT',
        changes: { locations, products, stock: { adjusted } },
      });
      return result;
    } finally {
      this.running.delete(shopId);
    }
  }

  // ---------- ubicaciones -> bodegas ----------

  /**
   * Cada ubicación activa de Shopify queda emparejada con una bodega: la ya vinculada, una bodega
   * con el mismo nombre que aún no esté vinculada, o una bodega nueva.
   */
  private async importLocations(tenant: TenantContext, userId: number, shopId: number) {
    const nodes = await this.paginate<ShopifyLocationNode>(tenant, shopId, LOCATIONS_QUERY, {}, (d) => (d as { locations: Page<ShopifyLocationNode> }).locations);
    const linked = await this.repo.linkedLocations(tenant.tenantId, shopId);
    const locationIds = new Map<string, number>();
    let created = 0;
    let linkedByName = 0;

    for (const node of nodes.filter((n) => n.isActive)) {
      await this.repo.transaction(async (tx) => {
        let locationId = linked.get(node.id);
        if (!locationId) {
          locationId = await this.repo.unlinkedLocationByName(tenant.tenantId, shopId, node.name, tx);
          if (locationId) linkedByName++;
        }
        if (!locationId) {
          const base = (slugify(node.name).toUpperCase() || 'SHOPIFY').slice(0, 40);
          const code = nextAvailableSlug(base, await this.repo.takenCodes(tenant.tenantId, base, tx));
          const a = node.address;
          const values = {
            code,
            name: node.name.slice(0, 255),
            type: 'warehouse',
            address1: a.address1?.slice(0, 255) ?? null,
            address2: a.address2?.slice(0, 255) ?? null,
            city: a.city?.slice(0, 100) ?? null,
            province: a.province?.slice(0, 100) ?? null,
            provinceCode: a.provinceCode?.slice(0, 10) ?? null,
            countryCode: a.countryCode && /^[A-Z]{2}$/.test(a.countryCode) ? a.countryCode : null,
            zip: a.zip?.slice(0, 20) ?? null,
            phone: a.phone?.slice(0, 50) ?? null,
          };
          locationId = await this.repo.insertLocation({ tenantId: tenant.tenantId, ...values }, tx);
          created++;
          await this.audit.record(
            {
              tenantId: tenant.tenantId,
              shopId,
              userId,
              source: 'SHOPIFY_SYNC',
              entityType: 'Location',
              entityId: locationId,
              action: 'CREATE',
              changes: { new: { code, name: values.name, shopifyGid: node.id } },
            },
            tx,
          );
        }
        await this.repo.upsertShopLocation(
          {
            tenantId: tenant.tenantId,
            shopId,
            locationId,
            shopifyGid: node.id,
            shopifyLegacyId: legacyId(node.id),
            shopifyName: node.name.slice(0, 255),
            isActive: node.isActive,
            fulfillsOnlineOrders: node.fulfillsOnlineOrders,
            hasActiveInventory: node.hasActiveInventory,
          },
          tx,
        );
        locationIds.set(node.id, locationId);
      });
    }
    return { total: locationIds.size, created, linked: linkedByName, locationIds };
  }

  // ---------- productos ----------

  private async importProducts(
    tenant: TenantContext,
    userId: number,
    shopId: number,
    warn: (product: string | null, message: string) => void,
  ): Promise<ShopifyImportResponse['products']> {
    const summaries = await this.paginate<ProductSummary>(tenant, shopId, PRODUCT_IDS_QUERY, {}, (d) => (d as { products: Page<ProductSummary> }).products);
    const links = await this.repo.links(shopId, 'PRODUCT', summaries.map((p) => p.id));
    // Productos vigentes en el ERP -> su categoría actual.
    const active = await this.repo.activeProductCategories(tenant.tenantId, [...links.values()].map((l) => l.erpId));
    const known = await this.taxonomy.byIds(summaries.flatMap((s) => (s.category ? [s.category.id] : [])));
    const counts = { total: summaries.length, created: 0, updated: 0, unchanged: 0, failed: 0 };

    for (const summary of summaries) {
      const link = links.get(summary.id);
      const productId = link && active.has(link.erpId) ? link.erpId : undefined;
      // Sin cambios en Shopify desde la última importación (y sigue en el ERP): no se reescribe.
      if (productId && link?.shopifyUpdatedAt?.getTime() === new Date(summary.updatedAt).getTime()) {
        // Importado antes de existir las categorías: solo se completa la categoría (sin tocar lo demás).
        const category = summary.category?.id;
        if (category && known.has(category) && !active.get(productId)) {
          await this.repo.setProductCategory(tenant.tenantId, productId, category);
          counts.updated++;
        } else counts.unchanged++;
        continue;
      }
      try {
        await this.importProduct(tenant, userId, shopId, summary.id, productId, warn);
        counts[productId ? 'updated' : 'created']++;
      } catch (error) {
        counts.failed++;
        const message = error instanceof HttpException ? error.message : 'Error inesperado al importar el producto';
        if (!(error instanceof HttpException)) this.logger.error(`Importación de ${summary.id} falló`, error instanceof Error ? error.stack : error);
        warn(summary.title, message);
      }
    }
    return counts;
  }

  private async importProduct(
    tenant: TenantContext,
    userId: number,
    shopId: number,
    gid: string,
    productId: number | undefined,
    warn: (product: string | null, message: string) => void,
  ): Promise<void> {
    const { product, variants } = await this.fetchProduct(tenant, shopId, gid);

    // Variantes del ERP que se conservan (vinculadas y aún vigentes en el producto).
    const current = productId ? await this.products.get(tenant, productId) : undefined;
    const kept = new Set(current?.variants.map((v) => v.id));
    const variantLinks = await this.repo.links(shopId, 'PRODUCT_VARIANT', variants.map((v) => v.id));
    const variantIds = new Map([...variantLinks].flatMap(([g, l]) => (kept.has(l.erpId) ? [[g, l.erpId] as const] : [])));

    const mediaIds = await this.importMedia(tenant, shopId, product, (m) => warn(product.title, m));
    const { input, warnings } = toProductInput(product, variants, variantIds, mediaIds);
    // Categoría de una versión de la taxonomía que el ERP aún no tiene: se importa sin ella (con aviso).
    if (input.categoryId && !(await this.taxonomy.byIds([input.categoryId])).has(input.categoryId)) {
      warnings.push('Su categoría de Shopify no está en la taxonomía cargada (npm run taxonomy:import): se importó sin categoría');
      input.categoryId = null;
    }
    for (const w of warnings) warn(product.title, w);

    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(`Datos no válidos (${issue.path.join('.') || 'producto'}): ${issue.message}`);
    }
    const options = { source: 'SHOPIFY_SYNC' as const, shopId };
    const save = (data: typeof parsed.data) =>
      productId ? this.products.update(tenant, userId, productId, data, options) : this.products.create(tenant, userId, data, options);

    let saved: ProductResponse;
    try {
      saved = await save(parsed.data);
    } catch (error) {
      // La URL de Shopify ya la usa otro producto del ERP: se importa con una generada desde el título.
      if (!(error instanceof ConflictException) || error.message !== HANDLE_TAKEN) throw error;
      warn(product.title, `La URL "${product.handle}" ya la usa otro producto: se generó otra`);
      saved = await save({ ...parsed.data, handle: null });
    }

    // Las variantes vuelven en el mismo orden en que se enviaron (posición).
    const ordered = [...variants].sort((a, b) => a.position - b.position);
    const linksToSave: LinkInput[] = [
      { resourceType: 'PRODUCT', erpId: saved.id, shopifyGid: product.id, shopifyUpdatedAt: new Date(product.updatedAt) },
      ...ordered.flatMap((v, i): LinkInput[] => [
        { resourceType: 'PRODUCT_VARIANT', erpId: saved.variants[i].id, shopifyGid: v.id },
        { resourceType: 'INVENTORY_ITEM', erpId: saved.variants[i].inventoryItemId, shopifyGid: v.inventoryItem.id },
      ]),
    ];
    await this.repo.transaction((tx) => this.repo.upsertLinks(tenant.tenantId, shopId, linksToSave, tx));
  }

  /** Producto con TODAS sus variantes (paginadas de 100 en 100). */
  private async fetchProduct(tenant: TenantContext, shopId: number, gid: string) {
    let after: string | null = null;
    let product: ShopifyProductNode | undefined;
    const variants: ShopifyVariantNode[] = [];
    do {
      const data: ProductPayload = await this.connection.graphql<ProductPayload>(tenant.tenantId, shopId, PRODUCT_QUERY, { id: gid, after });
      if (!data.product) throw new BadRequestException('El producto ya no existe en Shopify');
      product ??= data.product;
      variants.push(...data.product.variants.nodes);
      after = data.product.variants.pageInfo.hasNextPage ? data.product.variants.pageInfo.endCursor : null;
    } while (after);
    return { product: product!, variants };
  }

  /**
   * Copia al almacenamiento del ERP las imágenes del producto que aún no estén (vinculadas por GID).
   * Devuelve gid -> imagen del ERP. Una imagen que no se puede descargar se omite con un aviso.
   */
  private async importMedia(
    tenant: TenantContext,
    shopId: number,
    product: ShopifyProductNode,
    warn: (message: string) => void,
  ): Promise<Map<string, number>> {
    const images = product.media.nodes.filter((m): m is ShopifyMediaNode & { image: { url: string } } => m.mediaContentType === 'IMAGE' && !!m.image?.url);
    const skipped = product.media.nodes.length - images.length;
    if (skipped > 0) warn(`${skipped} archivo(s) multimedia que no son imágenes (o aún se procesan) no se importaron`);

    const links = await this.repo.links(shopId, 'MEDIA', images.map((m) => m.id));
    const stored = await this.repo.existingMediaIds(tenant.tenantId, [...links.values()].map((l) => l.erpId));
    const result = new Map<string, number>();
    const newLinks: LinkInput[] = [];
    for (const image of images) {
      const linked = links.get(image.id);
      if (linked && stored.has(linked.erpId)) {
        result.set(image.id, linked.erpId);
        continue;
      }
      try {
        const buffer = await downloadShopifyImage(image.image.url);
        const saved = await this.media.upload(tenant, { buffer, size: buffer.length }, filenameFromUrl(image.image.url));
        result.set(image.id, saved.id);
        newLinks.push({ resourceType: 'MEDIA', erpId: saved.id, shopifyGid: image.id, remoteUrl: image.image.url });
      } catch (error) {
        warn(`No se pudo copiar una imagen: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    }
    // Dos imágenes idénticas en Shopify se guardan una vez en el ERP: se vincula solo la primera.
    const unique = [...new Map(newLinks.map((l) => [l.erpId, l])).values()];
    if (unique.length) await this.repo.transaction((tx) => this.repo.upsertLinks(tenant.tenantId, shopId, unique, tx));
    return result;
  }

  // ---------- stock ----------

  /** Iguala el disponible de cada variante importada en cada bodega emparejada. */
  private async importStock(tenant: TenantContext, userId: number, shopId: number, locationIds: Map<string, number>): Promise<number> {
    const levels: { itemGid: string; locationId: number; available: number }[] = [];
    for (const [gid, locationId] of locationIds) {
      const nodes = await this.paginate<{ item: { id: string }; quantities: { name: string; quantity: number }[] }>(
        tenant,
        shopId,
        LOCATION_LEVELS_QUERY,
        { id: gid },
        (d) => (d as { location: { inventoryLevels: Page<never> } | null }).location?.inventoryLevels ?? EMPTY_PAGE,
      );
      for (const n of nodes) {
        const available = n.quantities.find((q) => q.name === 'available')?.quantity ?? 0;
        levels.push({ itemGid: n.item.id, locationId, available });
      }
    }
    const items = await this.repo.links(shopId, 'INVENTORY_ITEM', [...new Set(levels.map((l) => l.itemGid))]);
    const entries = levels.flatMap((l) => {
      const item = items.get(l.itemGid);
      return item ? [{ inventoryItemId: item.erpId, locationId: l.locationId, available: l.available }] : [];
    });
    return this.stock.syncFromShopify(tenant.tenantId, shopId, userId, entries);
  }

  // ---------- utilidades ----------

  /** Recorre todas las páginas de una conexión GraphQL. */
  private async paginate<T>(
    tenant: TenantContext,
    shopId: number,
    query: string,
    variables: Record<string, unknown>,
    pick: (data: unknown) => Page<T>,
  ): Promise<T[]> {
    const nodes: T[] = [];
    let after: string | null = null;
    do {
      const page = pick(await this.connection.graphql<unknown>(tenant.tenantId, shopId, query, { ...variables, after }));
      nodes.push(...page.nodes);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    return nodes;
  }
}

type Page<T> = { pageInfo: PageInfo; nodes: T[] };
const EMPTY_PAGE: Page<never> = { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };

/** Solo el CDN de Shopify (la URL viene de Shopify, pero se valida igual: evita SSRF). */
export function isShopifyCdnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'cdn.shopify.com' || url.hostname.endsWith('.cdn.shopify.com'));
  } catch {
    return false;
  }
}

/** "https://cdn.shopify.com/s/files/1/.../Main_b13a.jpg?v=1" -> "Main_b13a.jpg" (el nombre que muestra Shopify). */
export function filenameFromUrl(value: string): string | null {
  try {
    const last = new URL(value).pathname.split('/').pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

async function downloadShopifyImage(url: string): Promise<Buffer> {
  if (!isShopifyCdnUrl(url)) throw new Error('la imagen no está en el CDN de Shopify');
  const res = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    headers: { Accept: 'image/webp,image/png,image/jpeg,image/gif' },
  });
  if (!res.ok) throw new Error(`Shopify respondió ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MEDIA_MAX_BYTES) throw new Error('la imagen supera los 20 MB');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MEDIA_MAX_BYTES) throw new Error('la imagen supera los 20 MB');
  return buffer;
}
