import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type ConnectShopifyData, connectShopifySchema, type ShopResponse } from '@erp/contracts';
import { z } from 'zod';
import { CurrentAuth } from '../../shared/http/current-auth.decorator.js';
import type { AuthContext, TenantContext } from '../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../identity/index.js';
import { ShopifyConnectionService } from './shopify-connection.service.js';

const shopIdSchema = z.coerce.number().int().positive();

@ApiTags('shopify')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/shops')
export class ShopifyController {
  constructor(private readonly connection: ShopifyConnectionService) {}

  @Post('connect')
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Conectar una tienda de Shopify (la crea con sus datos; si ya estaba, la reconecta)' })
  connect(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: connectShopifySchema }) body: ConnectShopifyData,
  ): Promise<ShopResponse> {
    return this.connection.connect(tenant, auth.user.id, body);
  }

  @Post(':shopId/shopify/refresh')
  @HttpCode(200)
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Actualizar nombre, moneda, país, zona horaria y permisos desde Shopify' })
  refresh(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('shopId', { schema: shopIdSchema }) shopId: number,
  ): Promise<ShopResponse> {
    return this.connection.refreshInfo(tenant, auth.user.id, shopId);
  }

  @Delete(':shopId/shopify')
  @RequirePermission('shops:manage')
  @ApiOperation({ summary: 'Desconectar de Shopify (borra las credenciales guardadas)' })
  disconnect(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('shopId', { schema: shopIdSchema }) shopId: number,
  ): Promise<ShopResponse> {
    return this.connection.disconnect(tenant, auth.user.id, shopId);
  }
}
