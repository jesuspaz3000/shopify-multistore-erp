import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Paginated, paginated, type PaginationQuery, type RoleData, type RoleOptionResponse, type RoleResponse } from '@erp/contracts';
import { isUniqueViolation } from '../../../shared/database/pg-errors.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { AuditService } from '../../audit/audit.service.js';
import { canGrant } from '../permissions.js';
import { MembersRepository } from './members.repository.js';

const NAME_TAKEN = 'Ya existe un rol con ese nombre en la empresa';

/**
 * Roles de la empresa: los que trae por defecto y los que crea. Todos son editables y
 * eliminables (si no están en uso), salvo el Dueño, que es el único rol del sistema.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly repo: MembersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: PaginationQuery): Promise<Paginated<RoleResponse>> {
    const { items, total } = await this.repo.listRolesPage(tenant.tenantId, query);
    const roles = items.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.tenantId === null,
      membersCount: r.membersCount,
    }));
    return paginated(roles, total, query);
  }

  /** Todos los roles, sin paginar (selectores de rol al invitar o editar un miembro). */
  async options(tenant: TenantContext): Promise<RoleOptionResponse[]> {
    const rows = await this.repo.roleOptions(tenant.tenantId);
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, isSystem: r.tenantId === null }));
  }

  async create(tenant: TenantContext, actorUserId: number, input: RoleData): Promise<void> {
    this.assertCanGrant(tenant, input.permissions);
    try {
      await this.repo.transaction(async (tx) => {
        const role = await this.repo.insertRole(
          { tenantId: tenant.tenantId, name: input.name, description: input.description ?? null, permissions: input.permissions },
          tx,
        );
        await this.audit.record(
          { tenantId: tenant.tenantId, userId: actorUserId, source: 'ERP_USER', entityType: 'Role', entityId: role.id, action: 'CREATE', changes: { new: input } },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, 'roles_tenant_name_uq')) throw new ConflictException(NAME_TAKEN);
      throw error;
    }
  }

  /** Editar permisos afecta de inmediato a todos los miembros con ese rol. */
  async update(tenant: TenantContext, actorUserId: number, roleId: number, input: RoleData): Promise<void> {
    const role = await this.findOwnRole(tenant, roleId);
    this.assertCanGrant(tenant, role.permissions); // no se edita un rol más poderoso que el propio
    this.assertCanGrant(tenant, input.permissions); // ni se le dan permisos que uno no tiene
    try {
      await this.repo.transaction(async (tx) => {
        await this.repo.updateRole(
          tenant.tenantId,
          roleId,
          { name: input.name, description: input.description ?? null, permissions: input.permissions },
          tx,
        );
        await this.audit.record(
          {
            tenantId: tenant.tenantId,
            userId: actorUserId,
            source: 'ERP_USER',
            entityType: 'Role',
            entityId: roleId,
            action: 'UPDATE',
            changes: { old: { name: role.name, permissions: role.permissions }, new: input },
          },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, 'roles_tenant_name_uq')) throw new ConflictException(NAME_TAKEN);
      throw error;
    }
  }

  async remove(tenant: TenantContext, actorUserId: number, roleId: number): Promise<void> {
    const role = await this.findOwnRole(tenant, roleId);
    this.assertCanGrant(tenant, role.permissions);
    await this.repo.transaction(async (tx) => {
      const usage = await this.repo.roleUsage(roleId, tx);
      if (usage.members > 0 || usage.invitations > 0) {
        throw new ConflictException(
          'El rol está en uso: reasigna a sus miembros y cancela sus invitaciones pendientes antes de eliminarlo',
        );
      }
      await this.repo.deleteRole(tenant.tenantId, roleId, tx);
      await this.audit.record(
        { tenantId: tenant.tenantId, userId: actorUserId, source: 'ERP_USER', entityType: 'Role', entityId: roleId, action: 'DELETE', changes: { old: role } },
        tx,
      );
    });
  }

  private async findOwnRole(tenant: TenantContext, roleId: number) {
    const role = await this.repo.findRoleById(tenant.tenantId, roleId);
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.tenantId === null) throw new ForbiddenException('El rol Dueño es del sistema: siempre tiene todos los permisos y no se puede modificar');
    return role;
  }

  private assertCanGrant(tenant: TenantContext, permissions: readonly string[]) {
    if (!canGrant(tenant.permissions, permissions)) {
      throw new ForbiddenException('No puedes otorgar permisos que tu rol no tiene');
    }
  }
}
