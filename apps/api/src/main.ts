import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody: necesario para verificar el HMAC de los webhooks de Shopify.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // No revelar el stack tecnológico (X-Powered-By: Express).
  app.disable('x-powered-by');

  // 8080 por defecto (Next.js usa el 3000).
  // API_HOST=127.0.0.1 en local: la API solo es accesible desde esta máquina (vía Next /api).
  // En Docker se usa API_HOST=0.0.0.0 para que la red interna de contenedores la alcance.
  await app.listen(process.env.API_PORT ?? 8080, process.env.API_HOST ?? '127.0.0.1');
}
await bootstrap();
