import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { fk, id, timestamps, tsz } from '../../shared/database/columns.js';

// ------------------------------------------------------------
// Tenants, usuarios, roles y membresías (RBAC)
// ------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: id(),
  slug: varchar({ length: 63 }).notNull().unique(), // usado en la URL: /{slug}/{shop}/...
  companyName: varchar({ length: 255 }).notNull(),
  billingEmail: varchar({ length: 255 }),
  status: varchar({ length: 20 }).notNull().default('active'), // active | suspended | trialing | cancelled
  planTier: varchar({ length: 50 }).notNull().default('pro'),
  reportingCurrency: varchar({ length: 3 }).notNull().default('USD'),
  ...timestamps,
});

export const users = pgTable('users', {
  id: id(),
  email: varchar({ length: 255 }).notNull().unique(), // siempre normalizado a minúsculas
  passwordHash: varchar({ length: 255 }), // argon2id. NULL si solo entra con Google
  firstName: varchar({ length: 100 }).notNull(),
  lastName: varchar({ length: 100 }).notNull(),
  isSuperuser: boolean().notNull().default(false),
  status: varchar({ length: 20 }).notNull().default('active'), // active | invited | suspended
  emailVerifiedAt: tsz(),
  failedLoginAttempts: integer().notNull().default(0),
  lockedUntil: tsz(),
  lastLoginAt: tsz(),
  ...timestamps,
});

export const roles = pgTable(
  'roles',
  {
    id: id(),
    tenantId: fk().references(() => tenants.id, { onDelete: 'cascade' }), // NULL = rol global
    name: varchar({ length: 50 }).notNull(),
    description: varchar({ length: 255 }),
    permissions: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (t) => [unique('roles_tenant_name_uq').on(t.tenantId, t.name).nullsNotDistinct()],
);

export const tenantUsers = pgTable(
  'tenant_users',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: fk()
      .notNull()
      .references(() => roles.id),
    allShopsAccess: boolean().notNull().default(true),
    status: varchar({ length: 20 }).notNull().default('active'), // active | invited | revoked
    ...timestamps,
  },
  (t) => [
    unique('tenant_users_tenant_user_uq').on(t.tenantId, t.userId),
    index('tenant_users_user_idx').on(t.userId),
  ],
);

// ------------------------------------------------------------
// Autenticación: sesiones, tokens de un solo uso, invitaciones, Google
// ------------------------------------------------------------

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar({ length: 64 }).notNull().unique(), // SHA-256 del token de la cookie
    authMethod: varchar({ length: 20 }).notNull(), // PASSWORD | GOOGLE
    activeTenantId: fk().references(() => tenants.id, { onDelete: 'set null' }),
    ipAddress: varchar({ length: 45 }),
    userAgent: varchar({ length: 500 }),
    createdAt: tsz().notNull().defaultNow(),
    lastSeenAt: tsz().notNull().defaultNow(),
    expiresAt: tsz().notNull(),
    revokedAt: tsz(),
  },
  (t) => [index('user_sessions_user_idx').on(t.userId), index('user_sessions_expires_idx').on(t.expiresAt)],
);

export const userTokens = pgTable(
  'user_tokens',
  {
    id: id(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar({ length: 30 }).notNull(), // EMAIL_VERIFICATION | PASSWORD_RESET
    tokenHash: varchar({ length: 64 }).notNull().unique(),
    expiresAt: tsz().notNull(),
    usedAt: tsz(),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [index('user_tokens_user_type_idx').on(t.userId, t.type)],
);

export const tenantInvitations = pgTable(
  'tenant_invitations',
  {
    id: id(),
    tenantId: fk()
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar({ length: 255 }).notNull(),
    roleId: fk()
      .notNull()
      .references(() => roles.id),
    shopIds: fk().array(), // NULL = todas las tiendas
    tokenHash: varchar({ length: 64 }).notNull().unique(),
    invitedByUserId: fk()
      .notNull()
      .references(() => users.id),
    status: varchar({ length: 20 }).notNull().default('pending'), // pending | accepted | revoked | expired
    expiresAt: tsz().notNull(),
    acceptedAt: tsz(),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [index('tenant_invitations_tenant_email_idx').on(t.tenantId, t.email, t.status)],
);

export const userIdentities = pgTable(
  'user_identities',
  {
    id: id(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 30 }).notNull(), // GOOGLE
    providerUserId: varchar({ length: 255 }).notNull(), // claim 'sub'
    email: varchar({ length: 255 }),
    emailVerified: boolean().notNull().default(false),
    hostedDomain: varchar({ length: 255 }),
    lastLoginAt: tsz(),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [
    unique('user_identities_provider_sub_uq').on(t.provider, t.providerUserId),
    unique('user_identities_user_provider_uq').on(t.userId, t.provider),
  ],
);

export const oidcLoginStates = pgTable(
  'oidc_login_states',
  {
    stateHash: varchar({ length: 64 }).primaryKey(),
    provider: varchar({ length: 30 }).notNull(),
    codeVerifier: varchar({ length: 128 }).notNull(),
    nonce: varchar({ length: 128 }).notNull(),
    redirectTo: varchar({ length: 500 }),
    linkUserId: fk().references(() => users.id, { onDelete: 'cascade' }),
    invitationId: fk().references(() => tenantInvitations.id, { onDelete: 'cascade' }),
    expiresAt: tsz().notNull(),
    createdAt: tsz().notNull().defaultNow(),
  },
  (t) => [index('oidc_login_states_expires_idx').on(t.expiresAt)],
);

// Tipos inferidos útiles para repositorios
export type TenantRow = typeof tenants.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type UserSessionRow = typeof userSessions.$inferSelect;
