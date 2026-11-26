import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Límites por IP. Los contadores viven en memoria: con más de una instancia de la API
// habrá que moverlos a Redis (ThrottlerStorage compartido).
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Límite general para toda la API. */
const DEFAULT_LIMIT = { ttl: MINUTE, limit: 120 };

/** Límites estrictos para rutas sensibles (se aplican con @Throttle({ default: ... })). */
export const AUTH_LIMITS = {
  /** Por IP. El bloqueo por cuenta (5 intentos) está en el servicio de login. */
  login: { ttl: MINUTE, limit: 10 },
  register: { ttl: HOUR, limit: 5 },
} as const;

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_LIMIT],
      errorMessage: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
