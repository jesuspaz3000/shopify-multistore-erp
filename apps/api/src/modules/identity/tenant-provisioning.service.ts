import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Tx } from '../../shared/database/database.module.js';
import { AuditService, type AuditSource } from '../audit/audit.service.js';
import { IdentityRepository } from './identity.repository.js';
import type { TenantRow } from './identity.schema.js';
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
 * Alta de una empresa (tenant) con su dueño (rol OWNER). La usan el registro público
 * y el comando del superadmin (`npm run tenant:create`). Debe ejecutarse dentro de una transacción.
 */
@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly audit: AuditService,
  ) {}

  async createTenantWithOwner(input: ProvisionTenantInput, tx: Tx): Promise<TenantRow> {
    const ownerRoleId = await this.repo.findGlobalRoleId('OWNER', tx);
    if (!ownerRoleId) throw new InternalServerErrorException('Roles globales no inicializados (ejecuta las migraciones)');

    const base = slugify(input.companyName);
    const slug = nextAvailableSlug(base, await this.repo.takenSlugs(base, tx));
    const tenant = await this.repo.insertTenant({ slug, companyName: input.companyName, billingEmail: input.billingEmail }, tx);

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
