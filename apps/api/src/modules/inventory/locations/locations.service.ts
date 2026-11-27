import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateLocationData,
  type LocationOptionResponse,
  type LocationResponse,
  type LocationShopLink,
  type LocationType,
  type Paginated,
  paginated,
  type PaginationQuery,
  type SetLocationShopsData,
  type UpdateLocationData,
} from '@erp/contracts';
import { isUniqueViolation } from '../../../shared/database/pg-errors.js';
import type { Tx } from '../../../shared/database/database.module.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { type LocationRow, LocationsRepository } from './locations.repository.js';

const CODE_TAKEN = 'Ya existe una bodega con ese código';

function toLocationResponse(row: LocationRow, shops: LocationShopLink[]): LocationResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as LocationType,
    address1: row.address1,
    address2: row.address2,
    city: row.city,
    province: row.province,
    countryCode: row.countryCode,
    zip: row.zip,
    phone: row.phone,
    isActive: row.isActive,
    shops,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly repo: LocationsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: PaginationQuery): Promise<Paginated<LocationResponse>> {
    const { items, total } = await this.repo.listPage(tenant.tenantId, query);
    const links = await this.repo.shopLinks(
      tenant.tenantId,
      items.map((l) => l.id),
      tenant.allowedShopIds,
    );
    return paginated(
      items.map((row) => toLocationResponse(row, links.get(row.id) ?? [])),
      total,
      query,
    );
  }

  options(tenant: TenantContext): Promise<LocationOptionResponse[]> {
    return this.repo.options(tenant.tenantId);
  }

  async create(tenant: TenantContext, userId: number, input: CreateLocationData): Promise<LocationResponse> {
    const row = await this.uniqueCode(() =>
      this.repo.transaction(async (tx) => {
        const created = await this.repo.insert({ tenantId: tenant.tenantId, ...input }, tx);
        await this.record(tx, tenant, userId, created.id, 'CREATE', { new: input });
        return created;
      }),
    );
    return toLocationResponse(row, []);
  }

  async update(
    tenant: TenantContext,
    userId: number,
    locationId: number,
    input: UpdateLocationData,
  ): Promise<LocationResponse> {
    const current = await this.findOrFail(tenant, locationId);
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as UpdateLocationData;
    const row =
      Object.keys(changes).length === 0
        ? current
        : await this.uniqueCode(() =>
            this.repo.transaction(async (tx) => {
              const updated = await this.repo.update(tenant.tenantId, locationId, changes, tx);
              if (!updated) throw new NotFoundException('Bodega no encontrada');
              await this.record(tx, tenant, userId, locationId, 'UPDATE', {
                old: pick(current, Object.keys(changes)),
                new: changes,
              });
              return updated;
            }),
          );
    return this.withLinks(tenant, row);
  }

  /** Reemplaza las tiendas que abastece la bodega y su regla de stock en cada una. */
  async setShops(
    tenant: TenantContext,
    userId: number,
    locationId: number,
    input: SetLocationShopsData,
  ): Promise<LocationResponse> {
    const location = await this.findOrFail(tenant, locationId);
    const requested = input.shops.map((s) => s.shopId);
    const existing = await this.repo.existingShopIds(tenant.tenantId, requested);
    const allowed = tenant.allowedShopIds;
    // Una tienda de otra empresa o fuera del acceso del usuario es, para él, una tienda que no existe.
    if (requested.some((id) => !existing.has(id) || (allowed && !allowed.includes(id)))) {
      throw new BadRequestException('Alguna de las tiendas no existe o no tienes acceso a ella');
    }

    await this.repo.transaction(async (tx) => {
      await this.repo.replaceShopLinks(tenant.tenantId, locationId, input.shops, allowed, tx);
      await this.record(tx, tenant, userId, locationId, 'UPDATE', { new: { shops: input.shops } });
    });
    return this.withLinks(tenant, location);
  }

  /** Baja lógica: la bodega desaparece de las listas, deja de abastecer tiendas y libera su código. */
  async remove(tenant: TenantContext, userId: number, locationId: number): Promise<void> {
    const location = await this.findOrFail(tenant, locationId);
    const units = await this.repo.unitsOnHand(tenant.tenantId, locationId);
    if (units > 0) {
      throw new ConflictException(`La bodega aún tiene ${units} unidades. Ajusta su stock a 0 antes de eliminarla.`);
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.update(tenant.tenantId, locationId, { deletedAt: new Date(), isActive: false }, tx);
      await this.repo.deleteShopLinks(tenant.tenantId, locationId, tx);
      await this.record(tx, tenant, userId, locationId, 'DELETE', { old: { code: location.code, name: location.name } });
    });
  }

  private async findOrFail(tenant: TenantContext, locationId: number): Promise<LocationRow> {
    const row = await this.repo.findById(tenant.tenantId, locationId);
    if (!row) throw new NotFoundException('Bodega no encontrada');
    return row;
  }

  private async withLinks(tenant: TenantContext, row: LocationRow): Promise<LocationResponse> {
    const links = await this.repo.shopLinks(tenant.tenantId, [row.id], tenant.allowedShopIds);
    return toLocationResponse(row, links.get(row.id) ?? []);
  }

  /** El índice único (empresa, código) decide también entre altas simultáneas. */
  private async uniqueCode<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isUniqueViolation(error, 'locations_tenant_code_uq')) throw new ConflictException(CODE_TAKEN);
      throw error;
    }
  }

  private record(
    tx: Tx,
    tenant: TenantContext,
    userId: number,
    locationId: number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    changes: Record<string, unknown>,
  ) {
    return this.audit.record(
      { tenantId: tenant.tenantId, userId, source: 'ERP_USER', entityType: 'Location', entityId: locationId, action, changes },
      tx,
    );
  }
}

function pick(row: LocationRow, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, (row as Record<string, unknown>)[k]]));
}
