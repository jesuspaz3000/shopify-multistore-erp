import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Tx } from '../../shared/database/database.module.js';
import { AuditService, type AuditSource } from '../audit/audit.service.js';
import { IdentityRepository } from './identity.repository.js';
import type { TenantRow } from './identity.schema.js';
import { DEFAULT_TENANT_ROLES, OWNER_ROLE } from './permissions.js';
import { nextAvailableSlug, slugify } from './slug.js';

export type ProvisionTenantInput = {
  companyName: string;
  billingEmail: string;
  ownerUserId: number;
  /** Quién origina la creación (para auditoría). */
  source: AuditSource;
  actorUserId?: number;
  ipAddress?: string;
};

/**
 * Alta de una empresa (tenant): crea sus roles por defecto (editables) y asigna al dueño
 * el rol del sistema Dueño. La usan el registro público y `npm run tenant:create`.
 * Debe ejecutarse dentro de una transacción.
 */
@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly audit: AuditService,
  ) {}

  async createTenantWithOwner(input: ProvisionTenantInput, tx: Tx): Promise<TenantRow> {
    const ownerRoleId = await this.repo.findGlobalRoleId(OWNER_ROLE, tx);
    if (!ownerRoleId) throw new InternalServerErrorException('Rol Dueño no inicializado (ejecuta las migraciones)');

    const base = slugify(input.companyName);
    const slug = nextAvailableSlug(base, await this.repo.takenSlugs(base, tx));
    const tenant = await this.repo.insertTenant({ slug, companyName: input.companyName, billingEmail: input.billingEmail }, tx);

    await this.repo.insertTenantRoles(
      DEFAULT_TENANT_ROLES.map((r) => ({ tenantId: tenant.id, name: r.name, description: r.description, permissions: r.permissions })),
      tx,
    );
    await this.repo.insertMembership({ tenantId: tenant.id, userId: input.ownerUserId, roleId: ownerRoleId }, tx);
    await this.audit.record(
      {
        tenantId: tenant.id,
        userId: input.actorUserId ?? input.ownerUserId,
        source: input.source,
        entityType: 'Tenant',
        entityId: tenant.id,
        action: 'CREATE_TENANT',
        changes: { companyName: input.companyName, slug, ownerUserId: input.ownerUserId },
        ipAddress: input.ipAddress,
      },
      tx,
    );
    return tenant;
  }
}
