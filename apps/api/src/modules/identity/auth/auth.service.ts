import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthConfigResponse, LoginInput, MeResponse, RegisterInput } from '@erp/contracts';
import type { Env } from '../../../config/env.schema.js';
import { isUniqueViolation } from '../../../shared/database/pg-errors.js';
import type { AuthContext, RequestMeta } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { IdentityRepository } from '../identity.repository.js';
import { TenantProvisioningService } from '../tenant-provisioning.service.js';
import { isLocked, lockUntilFor } from './login-throttle.js';
import { PasswordService } from './password.service.js';
import { SessionsService } from './sessions.service.js';

const INVALID_CREDENTIALS = 'Email o contraseña incorrectos';

export type IssuedSession = { token: string; expiresAt: Date; me: MeResponse };

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly provisioning: TenantProvisioningService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Opciones de login disponibles (pública): el frontend oculta lo que no esté habilitado. */
  getConfig(): AuthConfigResponse {
    return {
      signupEnabled: this.config.get('ALLOW_SIGNUP', { infer: true }),
      googleEnabled: !!(this.config.get('GOOGLE_CLIENT_ID', { infer: true }) && this.config.get('GOOGLE_CLIENT_SECRET', { infer: true })),
    };
  }

  /** Alta de una empresa nueva: crea tenant + usuario dueño (OWNER) + sesión, en una transacción. */
  async register(input: RegisterInput, meta: RequestMeta): Promise<IssuedSession> {
    if (!this.config.get('ALLOW_SIGNUP', { infer: true })) {
      throw new ForbiddenException('El registro de nuevas empresas está deshabilitado');
    }

    // El hash es costoso (CPU): se calcula fuera de la transacción.
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const result = await this.repo.transaction(async (tx) => {
        if (await this.repo.findUserByEmail(input.email, tx)) {
          throw new ConflictException('Ya existe una cuenta con ese email');
        }

        const user = await this.repo.insertUser(
          { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, lastLoginAt: new Date() },
          tx,
        );
        await this.provisioning.createTenantWithOwner(
          {
            companyName: input.companyName,
            billingEmail: input.email,
            ownerUserId: user.id,
            source: 'ERP_USER',
            ipAddress: meta.ipAddress,
          },
          tx,
        );
        const session = await this.sessions.create(user.id, 'PASSWORD', meta, tx);
        return { userId: user.id, session };
      });

      return { token: result.session.token, expiresAt: result.session.expiresAt, me: await this.me(result.userId) };
    } catch (error) {
      // Dos registros simultáneos con el mismo email/slug: el UNIQUE de la BD decide.
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new ConflictException('Ya existe una cuenta con ese email');
      }
      if (isUniqueViolation(error, 'tenants_slug_unique')) {
        throw new ConflictException('Intenta nuevamente: el identificador de la empresa se acaba de ocupar');
      }
      throw error;
    }
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<IssuedSession> {
    const user = await this.repo.findUserByEmail(input.email);

    if (user && isLocked(user.lockedUntil)) {
      throw new HttpException('Demasiados intentos fallidos. Intenta nuevamente en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Siempre se verifica (aunque el usuario no exista) para no revelar qué emails existen por el tiempo de respuesta.
    const valid = await this.passwords.verify(user?.passwordHash, input.password);

    if (!user || !valid) {
      if (user) {
        const attempts = await this.repo.incrementFailedLogins(user.id);
        const lockUntil = lockUntilFor(attempts);
        if (lockUntil) await this.repo.lockUser(user.id, lockUntil);
        await this.audit.record({
          userId: user.id,
          source: 'ERP_USER',
          entityType: 'User',
          entityId: user.id,
          action: lockUntil ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
          ipAddress: meta.ipAddress,
        });
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status !== 'active') throw new ForbiddenException('La cuenta está suspendida');

    await this.repo.markSuccessfulLogin(user.id);
    const session = await this.sessions.create(user.id, 'PASSWORD', meta);
    await this.audit.record({
      userId: user.id,
      source: 'ERP_USER',
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN',
      ipAddress: meta.ipAddress,
    });

    return { token: session.token, expiresAt: session.expiresAt, me: await this.me(user.id) };
  }

  async logout(auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
  }

  async me(userId: number): Promise<MeResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedException('Sesión inválida o expirada');
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: !!user.emailVerifiedAt,
        isSuperuser: user.isSuperuser,
      },
      memberships: await this.repo.listMemberships(userId),
    };
  }
}
