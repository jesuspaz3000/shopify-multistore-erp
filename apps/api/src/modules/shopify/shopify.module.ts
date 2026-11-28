import { Module } from '@nestjs/common';
import { TokenCipher } from '../../shared/crypto/token-cipher.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ShopsModule } from '../shops/index.js';
import { ShopifyImportRepository } from './import/shopify-import.repository.js';
import { ShopifyImportService } from './import/shopify-import.service.js';
import { ShopifyAdminClient } from './shopify-admin.client.js';
import { ShopifyConnectionService } from './shopify-connection.service.js';
import { ShopifyController } from './shopify.controller.js';

/** Integración con Shopify: conexión de tiendas, cliente del Admin API e importación (ubicaciones, productos y stock). */
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule, ShopsModule, CatalogModule, InventoryModule],
  controllers: [ShopifyController],
  providers: [TokenCipher, ShopifyAdminClient, ShopifyConnectionService, ShopifyImportRepository, ShopifyImportService],
  exports: [ShopifyAdminClient, ShopifyConnectionService],
})
export class ShopifyModule {}
