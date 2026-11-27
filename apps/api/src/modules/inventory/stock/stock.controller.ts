import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdjustInventoryData,
  type AdjustInventoryResponse,
  adjustInventorySchema,
  type AdjustmentResponse,
  type AdjustmentsQuery,
  adjustmentsQuerySchema,
  type InventoryQuery,
  inventoryQuerySchema,
  type InventoryRow,
  type Paginated,
} from '@erp/contracts';
import { CurrentAuth } from '../../../shared/http/current-auth.decorator.js';
import type { AuthContext, TenantContext } from '../../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../../identity/index.js';
import { StockService } from './stock.service.js';

@ApiTags('inventory')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/inventory')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Stock por variante en una bodega (?locationId) o en todas, paginado (?page, ?pageSize, ?q)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: inventoryQuerySchema }) query: InventoryQuery,
  ): Promise<Paginated<InventoryRow>> {
    return this.stock.list(tenant, query);
  }

  @Post('adjustments')
  @HttpCode(200)
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Ajustar el disponible de varias variantes en una bodega (todo o nada; queda en el kardex)' })
  adjust(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: adjustInventorySchema }) body: AdjustInventoryData,
  ): Promise<AdjustInventoryResponse> {
    return this.stock.adjust(tenant, auth.user.id, body);
  }

  @Get('adjustments')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Historial de movimientos (kardex), paginado (?locationId, ?inventoryItemId, ?q)' })
  adjustments(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: adjustmentsQuerySchema }) query: AdjustmentsQuery,
  ): Promise<Paginated<AdjustmentResponse>> {
    return this.stock.adjustments(tenant, query);
  }
}
