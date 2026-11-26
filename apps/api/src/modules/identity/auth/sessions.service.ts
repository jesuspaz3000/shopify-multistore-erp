import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Env } from '../../../config/env.schema.js';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import type { AuthContext, RequestMeta } from '../../../shared/http/request-context.js';
import { userSessions, users } from '../identity.schema.js';
import { generateToken, hashToken } from './session-token.js';

export type AuthMethod = 'PASSWORD' | 'GOOGLE';

// Renovar la expiración como máximo cada 5 minutos (evita un UPDATE por request).
const RENEW_AFTER_MS = 5 * 60_000;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private ttlMs() {
    return this.config.get('SESSION_TTL_DAYS', { infer: true }) * 86_400_000;
  }

  /** Crea una sesión. Devuelve el token en claro (solo va en la cookie, nunca se guarda). */
  async create(userId: number, authMethod: AuthMethod, meta: RequestMeta, tx: Database | Tx = this.db) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.ttlMs());
    const [session] = await tx
      .insert(userSessions)
      .values({
        userId,
        tokenHash: hashToken(token),
        authMethod,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      })
      .returning({ id: userSessions.id });
    return { token, sessionId: session.id, expiresAt };
  }

  /**
   * Valida el token de la cookie. Devuelve el contexto de autenticación y, si la sesión
   * se renovó (sliding expiration), la nueva fecha de expiración para reemitir la cookie.
   */
  async validate(token: string): Promise<{ context: AuthContext; renewedUntil?: Date } | null> {
    const now = new Date();
    const [row] = await this.db
      .select({
        sessionId: userSessions.id,
        lastSeenAt: userSessions.lastSeenAt,
        userStatus: users.status,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          emailVerifiedAt: users.emailVerifiedAt,
          isSuperuser: users.isSuperuser,
        },
      })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(
        and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now)),
      )
      .limit(1);

    if (!row || row.userStatus !== 'active') return null;

    const { emailVerifiedAt, ...user } = row.user;
    const context: AuthContext = { sessionId: row.sessionId, user: { ...user, emailVerified: !!emailVerifiedAt } };

    if (now.getTime() - row.lastSeenAt.getTime() < RENEW_AFTER_MS) return { context };

    const renewedUntil = new Date(now.getTime() + this.ttlMs());
    await this.db
      .update(userSessions)
      .set({ lastSeenAt: now, expiresAt: renewedUntil })
      .where(eq(userSessions.id, row.sessionId));
    return { context, renewedUntil };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
  }

  /** Cierra todas las sesiones de un usuario (cambio de contraseña, suspensión). */
  async revokeAllForUser(userId: number): Promise<void> {
    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  }
}
