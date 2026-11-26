import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateShopData,
  createShopSchema,
  type ShopResponse,
  type UpdateShopData,
  updateShopSchema,
} from '@erp/contracts';
import { z } from 'zod';
import { CurrentAuth } from '../../shared/http/current-auth.decorator.js';
import type { AuthContext, TenantContext } from '../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../identity/index.js';
import { ShopsService } from './shops.service.js';

const shopIdSchema = z.coerce.number().int().positive();

@ApiTags('shops')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  @ApiOperation({ summary: 'Tiendas de la empresa (solo las permitidas al usuario)' })
  list(@CurrentTenant() tenant: TenantContext): Promise<ShopResponse[]> {
    return this.shops.list(tenant);
  }

  @Post()
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Agregar una tienda (queda pendiente de conexión con Shopify)' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: createShopSchema }) body: CreateShopData,
  ): Promise<ShopResponse> {
    return this.shops.create(tenant, auth.user.id, body);
  }

  @Patch(':shopId')
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Editar nombre, moneda, país o zona horaria de una tienda' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('shopId', { schema: shopIdSchema }) shopId: number,
    @Body({ schema: updateShopSchema }) body: UpdateShopData,
  ): Promise<ShopResponse> {
    return this.shops.update(tenant, auth.user.id, shopId, body);
  }

  @Delete(':shopId')
  @HttpCode(204)
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Eliminar una tienda aún no conectada a Shopify' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('shopId', { schema: shopIdSchema }) shopId: number,
  ): Promise<void> {
    return this.shops.remove(tenant, auth.user.id, shopId);
  }
}
