import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Paginated,
  type ProductBulkData,
  type ProductBulkResponse,
  productBulkSchema,
  type ProductData,
  type ProductFacetsResponse,
  productInputSchema,
  type ProductListItem,
  type ProductResponse,
  type ProductsQuery,
  productsQuerySchema,
} from '@erp/contracts';
import { z } from 'zod';
import { CurrentAuth } from '../../../shared/http/current-auth.decorator.js';
import type { AuthContext, TenantContext } from '../../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../../identity/index.js';
import { ProductsService } from './products.service.js';

const productIdSchema = z.coerce.number().int().positive();

@ApiTags('products')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('catalog:read')
  @ApiOperation({ summary: 'Catálogo maestro, paginado (?page, ?pageSize, ?q, ?status)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: productsQuerySchema }) query: ProductsQuery,
  ): Promise<Paginated<ProductListItem>> {
    return this.products.list(tenant, query);
  }

  // Rutas estáticas antes de las dinámicas (:productId).
  @Get('facets')
  @RequirePermission('catalog:read')
  @ApiOperation({ summary: 'Tipos, proveedores y etiquetas ya usados (sugerencias del formulario)' })
  facets(@CurrentTenant() tenant: TenantContext): Promise<ProductFacetsResponse> {
    return this.products.facets(tenant);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('catalog:write')
  @ApiOperation({ summary: 'Acción en bloque: activar, pasar a borrador, archivar o eliminar varios productos' })
  bulk(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: productBulkSchema }) body: ProductBulkData,
  ): Promise<ProductBulkResponse> {
    return this.products.bulk(tenant, auth.user.id, body);
  }

  @Get(':productId')
  @RequirePermission('catalog:read')
  @ApiOperation({ summary: 'Producto con sus opciones y variantes' })
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId', { schema: productIdSchema }) productId: number,
  ): Promise<ProductResponse> {
    return this.products.get(tenant, productId);
  }

  @Post()
  @RequirePermission('catalog:write')
  @ApiOperation({ summary: 'Crear un producto con sus opciones y variantes' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: productInputSchema }) body: ProductData,
  ): Promise<ProductResponse> {
    return this.products.create(tenant, auth.user.id, body);
  }

  @Put(':productId')
  @RequirePermission('catalog:write')
  @ApiOperation({ summary: 'Guardar el producto completo (enviar `version` para detectar ediciones simultáneas)' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('productId', { schema: productIdSchema }) productId: number,
    @Body({ schema: productInputSchema }) body: ProductData,
  ): Promise<ProductResponse> {
    return this.products.update(tenant, auth.user.id, productId, body);
  }

  @Delete(':productId')
  @HttpCode(204)
  @RequirePermission('catalog:write')
  @ApiOperation({ summary: 'Eliminar un producto (baja lógica)' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('productId', { schema: productIdSchema }) productId: number,
  ): Promise<void> {
    return this.products.remove(tenant, auth.user.id, productId);
  }
}
