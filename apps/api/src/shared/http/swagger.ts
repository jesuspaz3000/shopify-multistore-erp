import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../../modules/identity/auth/session-cookie.js';

// Documentación OpenAPI en /docs (solo fuera de producción).
// Los esquemas Zod usados con @Body({ schema }) aparecen automáticamente.
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Shopify ERP API')
    .setDescription('API del ERP multitenant para administrar varias tiendas Shopify.')
    .setVersion('0.1.0')
    .addCookieAuth(SESSION_COOKIE)
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    swaggerOptions: { withCredentials: true, persistAuthorization: true },
  });
}
