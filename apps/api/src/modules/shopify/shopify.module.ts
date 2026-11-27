import { Module } from '@nestjs/common';
import { TokenCipher } from '../../shared/crypto/token-cipher.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ShopsModule } from '../shops/index.js';
import { ShopifyAdminClient } from './shopify-admin.client.js';
import { ShopifyConnectionService } from './shopify-connection.service.js';
import { ShopifyController } from './shopify.controller.js';

/** Integración con Shopify: conexión de tiendas y cliente del Admin API (lo usarán los módulos de sincronización). */
@Module({
  imports: [AuditModule, IdentityModule, ShopsModule],
  controllers: [ShopifyController],
  providers: [TokenCipher, ShopifyAdminClient, ShopifyConnectionService],
  exports: [ShopifyAdminClient, ShopifyConnectionService],
})
export class ShopifyModule {}
