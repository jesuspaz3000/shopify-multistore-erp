import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';
import { setupSwagger } from './shared/http/swagger.js';

async function bootstrap() {
  // rawBody: necesario para verificar el HMAC de los webhooks de Shopify.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // No revelar el stack tecnológico (X-Powered-By: Express).
  app.disable('x-powered-by');
  // La API recibe el tráfico a través de Next.js (/api -> localhost): confiar en su X-Forwarded-For.
  app.set('trust proxy', 'loopback');

  // Cabeceras de seguridad. CSP desactivada: la API solo devuelve JSON (y Swagger UI la necesita inline).
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  // Valida @Body/@Param/@Query que declaren { schema } (Zod) y responde 400 si no cumplen.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    setupSwagger(app);
  }

  // API_HOST=127.0.0.1 en local: solo accesible desde esta máquina (vía Next /api).
  // En Docker se usa API_HOST=0.0.0.0 para que la red interna de contenedores la alcance.
  await app.listen(config.get('API_PORT', { infer: true }), config.get('API_HOST', { infer: true }));
}
await bootstrap();
