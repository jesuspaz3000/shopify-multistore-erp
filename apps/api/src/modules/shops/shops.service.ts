import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateShopData,
  type Paginated,
  paginated,
  type PaginationQuery,
  type ShopOptionResponse,
  type ShopResponse,
  type ShopStatus,
  type UpdateShopData,
} from '@erp/contracts';
import { isUniqueViolation } from '../../shared/database/pg-errors.js';
import type { TenantContext } from '../../shared/http/request-context.js';
import { AuditService } from '../audit/audit.service.js';
import { nextAvailableSlug, slugify } from '../identity/slug.js';
import { type ShopRow, ShopsRepository } from './shops.repository.js';

export function toShopResponse(row: ShopRow): ShopResponse {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    currencyCode: row.currencyCode,
    countryCode: row.countryCode,
    ianaTimezone: row.ianaTimezone,
    status: row.status as ShopStatus,
    myshopifyDomain: row.myshopifyDomain,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ShopsService {
  constructor(
    private readonly repo: ShopsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: PaginationQuery): Promise<Paginated<ShopResponse>> {
    const { items, total } = await this.repo.listPage(tenant.tenantId, tenant.allowedShopIds, query);
    return paginated(items.map(toShopResponse), total, query);
  }

  options(tenant: TenantContext): Promise<ShopOptionResponse[]> {
    return this.repo.options(tenant.tenantId, tenant.allowedShopIds);
  }

  /**
   * Crea una tienda en estado "pending_connection": existe en el ERP pero aún no está
   * conectada a Shopify (la conexión OAuth llegará cuando se configure la app en Shopify).
   */
  async create(tenant: TenantContext, userId: number, input: CreateShopData): Promise<ShopResponse> {
    try {
      const shop = await this.repo.transaction(async (tx) => {
        // El handle va en la URL (/{empresa}/{handle}): nunca puede ser "all", "settings", etc.
        const base = slugify(input.name);
        const handle = nextAvailableSlug(base, await this.repo.takenHandles(tenant.tenantId, base, tx));
        const created = await this.repo.insert(
          {
            tenantId: tenant.tenantId,
            handle,
            name: input.name,
            currencyCode: input.currencyCode,
            countryCode: input.countryCode,
            ianaTimezone: input.ianaTimezone,
          },
          tx,
        );
        await this.audit.record(
          {
            tenantId: tenant.tenantId,
            shopId: created.id,
            userId,
            source: 'ERP_USER',
            entityType: 'Shop',
            entityId: created.id,
            action: 'CREATE',
            changes: { new: input },
          },
          tx,
        );
        return created;
      });
      return toShopResponse(shop);
    } catch (error) {
      // Dos altas simultáneas con el mismo nombre: el índice único decide.
      if (isUniqueViolation(error, 'shops_tenant_handle_uq')) {
        throw new ConflictException('Ya existe una tienda con un nombre equivalente. Intenta nuevamente.');
      }
      throw error;
    }
  }

  async update(tenant: TenantContext, userId: number, shopId: number, input: UpdateShopData): Promise<ShopResponse> {
    const current = await this.findAccessible(tenant, shopId);
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as UpdateShopData;
    if (Object.keys(changes).length === 0) return toShopResponse(current);
    input = changes;
    // El handle no cambia al renombrar: así no se rompen los enlaces guardados.
    const updated = await this.repo.transaction(async (tx) => {
      const row = await this.repo.update(tenant.tenantId, shopId, input, tx);
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          shopId,
          userId,
          source: 'ERP_USER',
          entityType: 'Shop',
          entityId: shopId,
          action: 'UPDATE',
          changes: { old: pick(current, Object.keys(input)), new: input },
        },
        tx,
      );
      return row!;
    });
    return toShopResponse(updated);
  }

  /** Solo se pueden eliminar tiendas aún no conectadas (sin datos sincronizados). */
  async remove(tenant: TenantContext, userId: number, shopId: number): Promise<void> {
    const shop = await this.findAccessible(tenant, shopId);
    if (shop.status !== 'pending_connection') {
      throw new ConflictException('Solo se pueden eliminar tiendas que aún no están conectadas a Shopify');
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.delete(tenant.tenantId, shopId, tx);
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          userId,
          source: 'ERP_USER',
          entityType: 'Shop',
          entityId: shopId,
          action: 'DELETE',
          changes: { old: { name: shop.name, handle: shop.handle } },
        },
        tx,
      );
    });
  }

  /** Tienda de la empresa a la que el usuario tiene acceso; 404 en cualquier otro caso. */
  private async findAccessible(tenant: TenantContext, shopId: number): Promise<ShopRow> {
    const shop = await this.repo.findById(tenant.tenantId, shopId);
    if (!shop || (tenant.allowedShopIds && !tenant.allowedShopIds.includes(shopId))) {
      throw new NotFoundException('Tienda no encontrada');
    }
    return shop;
  }
}

function pick(row: ShopRow, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, (row as Record<string, unknown>)[k]]));
}
