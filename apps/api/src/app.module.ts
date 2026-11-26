import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.schema.js';
import { AuditModule } from './modules/audit/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { HealthModule } from './shared/health/health.module.js';

@Module({
  imports: [
    // Valida las variables de entorno al arrancar (Zod). El .env de la raíz lo carga
    // `nest start --env-file`; envFilePath es el respaldo (tests, drizzle, etc.).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validationSchema: envSchema,
    }),
    HealthModule,
    AuditModule,
    IdentityModule,
  ],
})
export class AppModule {}
