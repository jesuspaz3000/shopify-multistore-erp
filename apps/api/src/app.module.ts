import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.schema.js';
import { AuditModule } from './modules/audit/index.js';
import { CatalogModule } from './modules/catalog/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { InventoryModule } from './modules/inventory/index.js';
import { ShopifyModule } from './modules/shopify/index.js';
import { ShopsModule } from './modules/shops/index.js';
import { HealthModule } from './shared/health/health.module.js';
import { RateLimitModule } from './shared/http/rate-limit.js';

@Module({
  imports: [
    // Valida las variables de entorno al arrancar (Zod). El .env de la raíz lo carga
    // `nest start --env-file`; envFilePath es el respaldo (tests, drizzle, etc.).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validationSchema: envSchema,
    }),
    RateLimitModule,
    HealthModule,
    AuditModule,
    IdentityModule,
    ShopsModule,
    ShopifyModule,
    InventoryModule,
    CatalogModule,
  ],
})
export class AppModule {}
