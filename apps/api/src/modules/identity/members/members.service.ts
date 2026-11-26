import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type MemberResponse, type Paginated, paginated, type PaginationQuery, type UpdateMemberData } from '@erp/contracts';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { canGrant, OWNER_ROLE } from '../permissions.js';
import { MembersRepository } from './members.repository.js';


@Injectable()
export class MembersService {
  constructor(
    private readonly repo: MembersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, currentUserId: number, query: PaginationQuery): Promise<Paginated<MemberResponse>> {
    const { items, total } = await this.repo.listMembersPage(tenant.tenantId, query);
    const members = items.map((m) => ({
      tenantUserId: m.tenantUserId,
      userId: m.userId,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      role: m.role,
      allShopsAccess: m.allShopsAccess,
      shopIds: m.shopIds.map(Number),
      isYou: m.userId === currentUserId,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      joinedAt: m.joinedAt.toISOString(),
    }));
    return paginated(members, total, query);
  }

  /** Cambia rol y tiendas de un miembro. */
  async update(tenant: TenantContext, actorUserId: number, tenantUserId: number, input: UpdateMemberData): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const member = await this.repo.findMember(tenant.tenantId, tenantUserId, tx);
      if (!member) throw new NotFoundException('Miembro no encontrado');
      if (member.userId === actorUserId) throw new ForbiddenException('No puedes cambiar tu propio rol ni tus accesos');
      // No se puede administrar a alguien con más permisos (ej. un Administrador no toca al Dueño).
      if (!canGrant(tenant.permissions, member.rolePermissions)) {
        throw new ForbiddenException('No puedes modificar a un miembro con más permisos que tú');
      }

      const role = await this.repo.findRole(tenant.tenantId, input.roleName, tx);
      if (!role) throw new BadRequestException('roleName: El rol no existe');
      if (!canGrant(tenant.permissions, role.permissions)) {
        throw new ForbiddenException('No puedes asignar un rol con más permisos que el tuyo');
      }

      // Nunca dejar la empresa sin dueño.
      if (member.role === OWNER_ROLE && role.name !== OWNER_ROLE && (await this.repo.countOwners(tenant.tenantId, tx)) <= 1) {
        throw new ConflictException('La empresa debe tener al menos un Dueño');
      }

      const shopIds = await this.validShopIds(tenant.tenantId, input.allShopsAccess, input.shopIds, tx);
      await this.repo.updateMembership(tenantUserId, { roleId: role.id, allShopsAccess: input.allShopsAccess }, tx);
      await this.repo.replaceShopAccess(tenant.tenantId, tenantUserId, shopIds, tx);
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          userId: actorUserId,
          source: 'ERP_USER',
          entityType: 'TenantUser',
          entityId: tenantUserId,
          action: 'UPDATE_MEMBER',
          changes: { old: { role: member.role }, new: { role: role.name, allShopsAccess: input.allShopsAccess, shopIds } },
        },
        tx,
      );
    });
  }

  /** Quita a un miembro de la empresa (su cuenta sigue existiendo y conserva otras empresas). */
  async remove(tenant: TenantContext, actorUserId: number, tenantUserId: number): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const member = await this.repo.findMember(tenant.tenantId, tenantUserId, tx);
      if (!member) throw new NotFoundException('Miembro no encontrado');
      if (member.userId === actorUserId) throw new ForbiddenException('No puedes quitarte a ti mismo de la empresa');
      if (!canGrant(tenant.permissions, member.rolePermissions)) {
        throw new ForbiddenException('No puedes quitar a un miembro con más permisos que tú');
      }
      if (member.role === OWNER_ROLE && (await this.repo.countOwners(tenant.tenantId, tx)) <= 1) {
        throw new ConflictException('La empresa debe tener al menos un Dueño');
      }

      // El acceso se corta al instante: TenantGuard verifica la membresía en cada request.
      await this.repo.deleteMembership(tenantUserId, tx);
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          userId: actorUserId,
          source: 'ERP_USER',
          entityType: 'TenantUser',
          entityId: tenantUserId,
          action: 'REMOVE_MEMBER',
          changes: { old: { userId: member.userId, role: member.role } },
        },
        tx,
      );
    });
  }

  /** Con acceso restringido, las tiendas deben existir en la empresa. */
  async validShopIds(tenantId: number, allShopsAccess: boolean, shopIds: number[], tx: Parameters<MembersRepository['existingShopIds']>[2]) {
    if (allShopsAccess) return [];
    const unique = [...new Set(shopIds)];
    const existing = await this.repo.existingShopIds(tenantId, unique, tx);
    if (existing.length !== unique.length) throw new BadRequestException('shopIds: Alguna tienda no existe en la empresa');
    return existing;
  }
}
