import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateLocationData,
  createLocationSchema,
  type LocationOptionResponse,
  type LocationResponse,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type SetLocationShopsData,
  setLocationShopsSchema,
  type UpdateLocationData,
  updateLocationSchema,
} from '@erp/contracts';
import { z } from 'zod';
import { CurrentAuth } from '../../../shared/http/current-auth.decorator.js';
import type { AuthContext, TenantContext } from '../../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../../identity/index.js';
import { LocationsService } from './locations.service.js';

const locationIdSchema = z.coerce.number().int().positive();

@ApiTags('locations')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Bodegas de la empresa, paginadas (?page, ?pageSize, ?q)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Paginated<LocationResponse>> {
    return this.locations.list(tenant, query);
  }

  // Ruta estática declarada antes de las dinámicas (:locationId).
  @Get('options')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Bodegas activas (id, código, nombre) para selectores' })
  options(@CurrentTenant() tenant: TenantContext): Promise<LocationOptionResponse[]> {
    return this.locations.options(tenant);
  }

  @Post()
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Crear una bodega' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: createLocationSchema }) body: CreateLocationData,
  ): Promise<LocationResponse> {
    return this.locations.create(tenant, auth.user.id, body);
  }

  @Patch(':locationId')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Editar datos de una bodega o activarla/desactivarla' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('locationId', { schema: locationIdSchema }) locationId: number,
    @Body({ schema: updateLocationSchema }) body: UpdateLocationData,
  ): Promise<LocationResponse> {
    return this.locations.update(tenant, auth.user.id, locationId, body);
  }

  @Put(':locationId/shops')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Definir qué tiendas abastece la bodega y cuánto stock publica en cada una' })
  setShops(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('locationId', { schema: locationIdSchema }) locationId: number,
    @Body({ schema: setLocationShopsSchema }) body: SetLocationShopsData,
  ): Promise<LocationResponse> {
    return this.locations.setShops(tenant, auth.user.id, locationId, body);
  }

  @Delete(':locationId')
  @HttpCode(204)
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Eliminar una bodega (baja lógica)' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('locationId', { schema: locationIdSchema }) locationId: number,
  ): Promise<void> {
    return this.locations.remove(tenant, auth.user.id, locationId);
  }
}
