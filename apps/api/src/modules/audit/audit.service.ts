import { Inject, Injectable } from '@nestjs/common';
import { DB, type Database, type Tx } from '../../shared/database/database.module.js';
import { auditLogs } from './audit.schema.js';

export type AuditSource = 'ERP_USER' | 'SHOPIFY_WEBHOOK' | 'SHOPIFY_SYNC' | 'SYSTEM';

export type AuditEntry = {
  tenantId?: number | null;
  shopId?: number | null;
  userId?: number | null;
  source: AuditSource;
  entityType: string;
  entityId?: number | null;
  action: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Registra un evento. Pasar `tx` para que quede en la misma transacción que el cambio. */
  async record(entry: AuditEntry, tx: Database | Tx = this.db): Promise<void> {
    await tx.insert(auditLogs).values(entry);
  }
}
