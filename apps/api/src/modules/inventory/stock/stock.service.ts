import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdjustInventoryData,
  type AdjustInventoryResponse,
  type AdjustmentReason,
  type AdjustmentResponse,
  type AdjustmentsQuery,
  DEFAULT_VARIANT_TITLE,
  type InventoryQuery,
  type InventoryRow,
  type Paginated,
  paginated,
} from '@erp/contracts';
import type { Tx } from '../../../shared/database/database.module.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { StockRepository } from './stock.repository.js';

const variantTitle = (title: string) => (title === DEFAULT_VARIANT_TITLE ? null : title);

@Injectable()
export class StockService {
  constructor(private readonly repo: StockRepository) {}

  async list(tenant: TenantContext, query: InventoryQuery): Promise<Paginated<InventoryRow>> {
    if (query.locationId) await this.activeLocation(tenant, query.locationId);
    const { items, total } = await this.repo.listPage(tenant.tenantId, query);
    return paginated(
      items.map((row) => ({ ...row, variantTitle: variantTitle(row.variantTitle) })),
      total,
      query,
    );
  }

  /**
   * Ajusta el disponible de varias variantes en una bodega, todo o nada.
   * - `delta`: suma/resta unidades (recepción, merma...).
   * - `quantity`: fija la cantidad (conteo); con `compareQuantity` se rechaza si alguien la cambió antes.
   * Cada cambio queda en el kardex con la cantidad resultante.
   */
  async adjust(tenant: TenantContext, userId: number, input: AdjustInventoryData): Promise<AdjustInventoryResponse> {
    await this.activeLocation(tenant, input.locationId);
    const itemIds = input.changes.map((c) => c.inventoryItemId);
    const adjustable = await this.repo.adjustableItemIds(tenant.tenantId, itemIds);
    if (itemIds.some((id) => !adjustable.has(id))) {
      throw new BadRequestException('Alguna variante no existe o no controla stock');
    }

    return this.repo.transaction(async (tx) => {
      const levels = await this.repo.lockLevels(tenant.tenantId, input.locationId, itemIds, tx);
      const result: AdjustInventoryResponse['levels'] = [];
      const kardex: Parameters<StockRepository['insertAdjustments']>[0] = [];

      for (const change of input.changes) {
        const current = levels.get(change.inventoryItemId)!;
        if (change.compareQuantity !== undefined && change.compareQuantity !== current.available) {
          throw new ConflictException(
            `El stock cambió mientras editabas (ahora hay ${current.available} disponibles). Recarga y vuelve a intentarlo.`,
          );
        }
        const delta = change.delta ?? change.quantity! - current.available;
        if (current.available + delta < 0) {
          throw new BadRequestException(`No hay suficiente stock: hay ${current.available} disponibles`);
        }
        if (delta === 0) {
          result.push({ inventoryItemId: change.inventoryItemId, available: current.available, onHand: current.onHand });
          continue;
        }
        const updated = await this.repo.applyAvailableDelta(tenant.tenantId, input.locationId, change.inventoryItemId, delta, tx);
        result.push({ inventoryItemId: change.inventoryItemId, ...updated });
        kardex.push({
          tenantId: tenant.tenantId,
          inventoryItemId: change.inventoryItemId,
          locationId: input.locationId,
          quantityName: 'available',
          delta,
          quantityAfter: updated.available,
          reason: input.reason,
          note: input.note,
          source: 'ERP',
          userId,
        });
      }
      await this.repo.insertAdjustments(kardex, tx);
      return { levels: result };
    });
  }

  async adjustments(tenant: TenantContext, query: AdjustmentsQuery): Promise<Paginated<AdjustmentResponse>> {
    const { items, total } = await this.repo.adjustmentsPage(tenant.tenantId, query);
    return paginated(
      items.map(({ firstName, lastName, ...row }) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        variantTitle: variantTitle(row.variantTitle),
        reason: row.reason as AdjustmentReason,
        source: row.source as AdjustmentResponse['source'],
        userName: firstName ? `${firstName} ${lastName ?? ''}`.trim() : null,
      })),
      total,
      query,
    );
  }

  /** Disponible por bodega de cada ítem (lo usa el catálogo en la ficha de producto). */
  async levelsByItem(tenantId: number, itemIds: number[]): Promise<Map<number, { locationId: number; available: number }[]>> {
    const result = new Map<number, { locationId: number; available: number }[]>(itemIds.map((id) => [id, []]));
    for (const { itemId, ...level } of await this.repo.levelsByItem(tenantId, itemIds)) result.get(itemId)?.push(level);
    return result;
  }

  /**
   * Stock inicial de ítems recién creados (al crear un producto o una variante nueva), dentro de la
   * transacción del catálogo: si una bodega no es válida, no se crea nada. Queda en el kardex como "initial".
   */
  async seedInitialStock(
    tenantId: number,
    userId: number,
    entries: { inventoryItemId: number; locationId: number; quantity: number }[],
    tx: Tx,
  ): Promise<void> {
    const withStock = entries.filter((e) => e.quantity > 0);
    if (withStock.length === 0) return;
    const requested = [...new Set(withStock.map((e) => e.locationId))];
    const active = await this.repo.activeLocationIds(tenantId, requested, tx);
    if (requested.some((id) => !active.has(id))) {
      throw new BadRequestException('Alguna bodega no existe o está inactiva');
    }
    await this.repo.insertLevels(withStock.map((e) => ({ tenantId, ...e })), tx);
    await this.repo.insertAdjustments(
      withStock.map((e) => ({
        tenantId,
        inventoryItemId: e.inventoryItemId,
        locationId: e.locationId,
        quantityName: 'available',
        delta: e.quantity,
        quantityAfter: e.quantity,
        reason: 'initial',
        source: 'ERP',
        userId,
      })),
      tx,
    );
  }

  private async activeLocation(tenant: TenantContext, locationId: number) {
    const location = await this.repo.findActiveLocation(tenant.tenantId, locationId);
    if (!location) throw new NotFoundException('Bodega no encontrada o inactiva');
  }
}
