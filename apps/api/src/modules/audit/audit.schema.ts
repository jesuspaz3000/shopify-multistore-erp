import { index, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { fk, id, tsz } from '../../shared/database/columns.js';
import { tenants, users } from '../identity/identity.schema.js';

// Bitácora inmutable de auditoría. (Particionar por mes cuando crezca.)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    tenantId: fk().references(() => tenants.id, { onDelete: 'cascade' }), // NULL = evento global (ej. login fallido)
    shopId: fk(),
    userId: fk().references(() => users.id, { onDelete: 'set null' }),
    source: varchar({ length: 20 }).notNull(), // ERP_USER | SHOPIFY_WEBHOOK | SHOPIFY_SYNC | SYSTEM
    entityType: varchar({ length: 50 }).notNull(),
    entityId: fk(),
    action: varchar({ length: 30 }).notNull(),
    changes: jsonb().$type<Record<string, unknown>>(),
    ipAddress: varchar({ length: 45 }),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_tenant_entity_idx').on(t.tenantId, t.entityType, t.entityId),
    index('audit_logs_tenant_created_idx').on(t.tenantId, t.createdAt),
  ],
);
