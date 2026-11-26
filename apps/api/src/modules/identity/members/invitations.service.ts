import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AcceptInvitationData,
  acceptInvitationNewUserSchema,
  type CreatedInvitationResponse,
  type InvitationPreviewResponse,
  type InvitationResponse,
  type InvitationStatus,
  type InviteMemberData,
  type Paginated,
  paginated,
  type PaginationQuery,
} from '@erp/contracts';
import type { Env } from '../../../config/env.schema.js';
import { isUniqueViolation } from '../../../shared/database/pg-errors.js';
import type { RequestMeta, TenantContext } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { PasswordService } from '../auth/password.service.js';
import { generateToken, hashToken } from '../auth/session-token.js';
import { SessionsService } from '../auth/sessions.service.js';
import { IdentityRepository } from '../identity.repository.js';
import { canGrant } from '../permissions.js';
import { MembersRepository } from './members.repository.js';
import { MembersService } from './members.service.js';

export const INVITATION_TTL_MS = 7 * 86_400_000;

type InvitationRow = NonNullable<Awaited<ReturnType<MembersRepository['findInvitation']>>>;

function statusOf(row: { status: string; expiresAt: Date }): InvitationStatus {
  if (row.status === 'pending' && row.expiresAt.getTime() <= Date.now()) return 'expired';
  return row.status as InvitationStatus;
}

function toResponse(row: InvitationRow): InvitationResponse {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    allShopsAccess: row.shopIds === null,
    shopIds: (row.shopIds ?? []).map(Number),
    status: statusOf(row),
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly repo: MembersRepository,
    private readonly identity: IdentityRepository,
    private readonly members: MembersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private inviteUrl(token: string) {
    return `${this.config.get('WEB_ORIGIN', { infer: true })}/invite/${token}`;
  }

  async list(tenant: TenantContext, query: PaginationQuery): Promise<Paginated<InvitationResponse>> {
    const { items, total } = await this.repo.listInvitationsPage(tenant.tenantId, query);
    return paginated(items.map(toResponse), total, query);
  }

  /** Crea una invitación de un solo uso. El link (con el token) se devuelve UNA vez; solo se guarda su hash. */
  async create(tenant: TenantContext, actorUserId: number, input: InviteMemberData): Promise<CreatedInvitationResponse> {
    const token = generateToken();
    try {
      const id = await this.repo.transaction(async (tx) => {
        const role = await this.repo.findRole(tenant.tenantId, input.roleName, tx);
        if (!role) throw new BadRequestException('roleName: El rol no existe');
        if (!canGrant(tenant.permissions, role.permissions)) {
          throw new ForbiddenException('No puedes invitar con un rol con más permisos que el tuyo');
        }

        const existingUser = await this.identity.findUserByEmail(input.email, tx);
        if (existingUser && (await this.repo.isMember(tenant.tenantId, existingUser.id, tx))) {
          throw new ConflictException('Esa persona ya es miembro de la empresa');
        }
        const pending = await this.repo.findPendingInvitationByEmail(tenant.tenantId, input.email, tx);
        if (pending && pending.expiresAt.getTime() > Date.now()) {
          throw new ConflictException('Ya hay una invitación pendiente para ese email: reenvíala o cancélala');
        }
        if (pending) await this.repo.updateInvitation(pending.id, { status: 'expired' }, tx);

        const shopIds = await this.members.validShopIds(tenant.tenantId, input.allShopsAccess, input.shopIds, tx);
        const created = await this.repo.insertInvitation(
          {
            tenantId: tenant.tenantId,
            email: input.email,
            roleId: role.id,
            shopIds: input.allShopsAccess ? null : shopIds,
            tokenHash: hashToken(token),
            invitedByUserId: actorUserId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          },
          tx,
        );
        await this.audit.record(
          {
            tenantId: tenant.tenantId,
            userId: actorUserId,
            source: 'ERP_USER',
            entityType: 'Invitation',
            entityId: created.id,
            action: 'INVITE',
            changes: { new: { email: input.email, role: role.name, allShopsAccess: input.allShopsAccess, shopIds } },
          },
          tx,
        );
        return created.id;
      });
      const row = await this.repo.findInvitation(tenant.tenantId, id);
      return { ...toResponse(row!), inviteUrl: this.inviteUrl(token) };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Intenta nuevamente');
      throw error;
    }
  }

  /** Genera un link NUEVO (el anterior deja de servir) y renueva el vencimiento. */
  async resend(tenant: TenantContext, actorUserId: number, invitationId: number): Promise<CreatedInvitationResponse> {
    const row = await this.findManageable(tenant, invitationId);
    if (row.status !== 'pending') throw new ConflictException('La invitación ya no está pendiente');
    const token = generateToken();
    await this.repo.updateInvitation(invitationId, { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) });
    await this.audit.record({
      tenantId: tenant.tenantId,
      userId: actorUserId,
      source: 'ERP_USER',
      entityType: 'Invitation',
      entityId: invitationId,
      action: 'RESEND_INVITE',
    });
    const updated = await this.repo.findInvitation(tenant.tenantId, invitationId);
    return { ...toResponse(updated!), inviteUrl: this.inviteUrl(token) };
  }

  async revoke(tenant: TenantContext, actorUserId: number, invitationId: number): Promise<void> {
    const row = await this.findManageable(tenant, invitationId);
    if (row.status !== 'pending') throw new ConflictException('La invitación ya no está pendiente');
    await this.repo.updateInvitation(invitationId, { status: 'revoked' });
    await this.audit.record({
      tenantId: tenant.tenantId,
      userId: actorUserId,
      source: 'ERP_USER',
      entityType: 'Invitation',
      entityId: invitationId,
      action: 'REVOKE_INVITE',
    });
  }

  // ---------- Pantalla pública /invite/[token] ----------

  async preview(token: string): Promise<InvitationPreviewResponse> {
    const row = await this.findUsable(token);
    const user = await this.identity.findUserByEmail(row.email);
    return {
      companyName: row.companyName,
      email: row.email,
      role: row.role,
      invitedBy: row.invitedBy,
      expiresAt: row.expiresAt.toISOString(),
      userExists: !!user,
    };
  }

  /**
   * Acepta la invitación e inicia sesión. Sin cuenta: crea el usuario (el link prueba que controla
   * ese email). Con cuenta: confirma con su contraseña actual.
   */
  async accept(token: string, input: AcceptInvitationData, meta: RequestMeta) {
    const invitation = await this.findUsable(token);
    const existingUser = await this.identity.findUserByEmail(invitation.email);

    // Lo costoso (argon2) va antes de la transacción.
    let newUser: { firstName: string; lastName: string; passwordHash: string } | undefined;
    if (existingUser) {
      if (existingUser.status !== 'active') throw new ForbiddenException('La cuenta está suspendida');
      if (!(await this.passwords.verify(existingUser.passwordHash, input.password))) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }
    } else {
      const parsed = acceptInvitationNewUserSchema.safeParse(input);
      if (!parsed.success) {
        throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      }
      newUser = {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash: await this.passwords.hash(parsed.data.password),
      };
    }

    try {
      return await this.repo.transaction(async (tx) => {
        // Se vuelve a leer bloqueando la fila: dos aceptaciones simultáneas no pueden usarla dos veces.
        const locked = await this.repo.findInvitationByTokenHash(hashToken(token), tx, true);
        if (!locked || statusOf(locked) !== 'pending') throw new GoneException('La invitación ya no es válida');

        const userId =
          existingUser?.id ??
          (await this.identity.insertUser({ email: invitation.email, emailVerifiedAt: new Date(), ...newUser! }, tx)).id;

        if (!(await this.repo.isMember(locked.tenantId, userId, tx))) {
          const membership = await this.repo.insertMembership(
            { tenantId: locked.tenantId, userId, roleId: locked.roleId, allShopsAccess: locked.shopIds === null },
            tx,
          );
          // Solo tiendas que sigan existiendo (pudieron eliminarse después de invitar).
          const shopIds = await this.repo.existingShopIds(locked.tenantId, (locked.shopIds ?? []).map(Number), tx);
          await this.repo.replaceShopAccess(locked.tenantId, membership.id, shopIds, tx);
        }

        await this.repo.updateInvitation(locked.id, { status: 'accepted', acceptedAt: new Date() }, tx);
        const session = await this.sessions.create(userId, 'PASSWORD', meta, tx);
        await this.audit.record(
          {
            tenantId: locked.tenantId,
            userId,
            source: 'ERP_USER',
            entityType: 'Invitation',
            entityId: locked.id,
            action: 'ACCEPT_INVITE',
            ipAddress: meta.ipAddress,
          },
          tx,
        );
        return { slug: locked.slug, token: session.token, expiresAt: session.expiresAt };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_unique')) throw new ConflictException('Intenta nuevamente');
      throw error;
    }
  }

  /** Invitación válida por token: existe, sigue pendiente, no venció y la empresa está activa. */
  private async findUsable(token: string) {
    const row = await this.repo.findInvitationByTokenHash(hashToken(token));
    if (!row || row.tenantStatus !== 'active') throw new NotFoundException('Invitación no encontrada');
    const status = statusOf(row);
    if (status !== 'pending') {
      throw new GoneException(status === 'accepted' ? 'Esta invitación ya fue aceptada' : 'Esta invitación venció o fue cancelada');
    }
    return row;
  }

  private async findManageable(tenant: TenantContext, invitationId: number) {
    const row = await this.repo.findInvitation(tenant.tenantId, invitationId);
    if (!row) throw new NotFoundException('Invitación no encontrada');
    if (!canGrant(tenant.permissions, row.rolePermissions)) {
      throw new ForbiddenException('No puedes gestionar una invitación con más permisos que los tuyos');
    }
    return { ...row, status: statusOf(row) };
  }
}
