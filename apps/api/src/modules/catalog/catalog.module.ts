import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { StorageModule } from '../../shared/storage/storage.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { MediaController } from './media/media.controller.js';
import { MediaRepository } from './media/media.repository.js';
import { MediaService } from './media/media.service.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsRepository } from './products/products.repository.js';
import { ProductsService } from './products/products.service.js';
import { TenantCurrencyReader } from './products/tenant-currency.reader.js';

// Catálogo maestro: productos, opciones, variantes (cada una con su ítem de inventario) e imágenes.
// Pendiente: categorías, colecciones, bundles, publicación por tienda.
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule, InventoryModule, StorageModule],
  controllers: [ProductsController, MediaController],
  providers: [ProductsRepository, ProductsService, TenantCurrencyReader, MediaRepository, MediaService],
  exports: [ProductsService],
})
export class CatalogModule {}
