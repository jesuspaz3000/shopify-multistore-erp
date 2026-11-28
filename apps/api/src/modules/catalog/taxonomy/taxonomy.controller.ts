import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type TaxonomyCategoryResponse, type TaxonomyQuery, taxonomyQuerySchema } from '@erp/contracts';
import { RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../../identity/index.js';
import { TaxonomyService } from './taxonomy.service.js';

@ApiTags('catalog')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/taxonomy/categories')
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  @RequirePermission('catalog:read')
  // La taxonomía cambia solo con una versión nueva: el navegador puede reutilizar la respuesta un rato.
  @Header('Cache-Control', 'private, max-age=3600')
  @ApiOperation({ summary: 'Buscar categorías de producto (q) o navegar por niveles (parentId)' })
  list(@Query({ schema: taxonomyQuerySchema }) query: TaxonomyQuery): Promise<TaxonomyCategoryResponse[]> {
    return this.taxonomy.list(query);
  }
}
