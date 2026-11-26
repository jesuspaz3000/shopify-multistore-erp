import { Inject, Injectable } from '@nestjs/common';
import type { TenantMembership } from '@erp/contracts';
import { and, asc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../shared/database/database.module.js';
import { tenantUserShops } from '../shops/shops.schema.js';
import { roles, tenants, tenantUsers, users } from './identity.schema.js';

type Executor = Database | Tx;

// Consultas del módulo de identidad (las reglas viven en los servicios).
@Injectable()
export class IdentityRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async findUserByEmail(email: string, tx: Executor = this.db) {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async findUserById(id: number, tx: Executor = this.db) {
    const [user] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async insertUser(values: typeof users.$inferInsert, tx: Executor = this.db) {
    const [user] = await tx.insert(users).values(values).returning();
    return user;
  }

  async findGlobalRoleId(name: string, tx: Executor = this.db): Promise<number | undefined> {
    const [role] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(isNull(roles.tenantId), eq(roles.name, name)))
      .limit(1);
    return role?.id;
  }

  /** Slugs ocupados que empiezan como `base` (para elegir el siguiente libre). */
  async takenSlugs(base: string, tx: Executor = this.db): Promise<Set<string>> {
    const rows = await tx
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(or(eq(tenants.slug, base), like(tenants.slug, `${base}-%`)));
    return new Set(rows.map((r) => r.slug));
  }

  async insertTenant(values: typeof tenants.$inferInsert, tx: Executor = this.db) {
    const [tenant] = await tx.insert(tenants).values(values).returning();
    return tenant;
  }

  async insertMembership(values: typeof tenantUsers.$inferInsert, tx: Executor = this.db) {
    const [membership] = await tx.insert(tenantUsers).values(values).returning();
    return membership;
  }

  async listMemberships(userId: number, tx: Executor = this.db): Promise<TenantMembership[]> {
    return tx
      .select({
        tenantId: tenants.id,
        slug: tenants.slug,
        companyName: tenants.companyName,
        role: roles.name,
        permissions: roles.permissions,
        allShopsAccess: tenantUsers.allShopsAccess,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.status, 'active'), eq(tenants.status, 'active')))
      .orderBy(asc(tenants.companyName));
  }

  /** Membresía activa del usuario en la empresa con ese slug (o undefined). */
  async findMembershipBySlug(userId: number, slug: string, tx: Executor = this.db) {
    const [membership] = await tx
      .select({
        tenantId: tenants.id,
        slug: tenants.slug,
        tenantUserId: tenantUsers.id,
        role: roles.name,
        permissions: roles.permissions,
        allShopsAccess: tenantUsers.allShopsAccess,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(
        and(
          eq(tenantUsers.userId, userId),
          eq(tenants.slug, slug),
          eq(tenantUsers.status, 'active'),
          eq(tenants.status, 'active'),
        ),
      )
      .limit(1);
    return membership;
  }

  /** Tiendas permitidas para una membresía con acceso restringido (tenant_users.all_shops_access = false). */
  async allowedShopIds(tenantUserId: number, tx: Executor = this.db): Promise<number[]> {
    const rows = await tx
      .select({ shopId: tenantUserShops.shopId })
      .from(tenantUserShops)
      .where(eq(tenantUserShops.tenantUserId, tenantUserId));
    return rows.map((r) => r.shopId);
  }

  /** Suma 1 intento fallido de forma ATÓMICA (seguro ante logins concurrentes). */
  async incrementFailedLogins(userId: number, tx: Executor = this.db): Promise<number> {
    const [row] = await tx
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
      .where(eq(users.id, userId))
      .returning({ attempts: users.failedLoginAttempts });
    return row?.attempts ?? 0;
  }

  async lockUser(userId: number, until: Date, tx: Executor = this.db) {
    await tx.update(users).set({ lockedUntil: until, failedLoginAttempts: 0 }).where(eq(users.id, userId));
  }

  async markSuccessfulLogin(userId: number, tx: Executor = this.db) {
    await tx
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }
}
