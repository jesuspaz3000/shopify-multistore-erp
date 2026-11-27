import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsRepository } from './products/products.repository.js';
import { ProductsService } from './products/products.service.js';
import { TenantCurrencyReader } from './products/tenant-currency.reader.js';

// Catálogo maestro: productos, opciones y variantes (cada variante con su ítem de inventario).
// Pendiente: media, bundles, publicación por tienda.
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule, InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsRepository, ProductsService, TenantCurrencyReader],
  exports: [ProductsService],
})
export class CatalogModule {}
