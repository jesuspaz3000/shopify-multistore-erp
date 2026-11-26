import { Inject, Injectable } from '@nestjs/common';
import { likePattern, type PaginationQuery } from '@erp/contracts';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { shops, tenantUserShops } from '../../shops/shops.schema.js';
import { roles, tenantInvitations, tenants, tenantUsers, users } from '../identity.schema.js';

type Executor = Database | Tx;

const inviter = alias(users, 'inviter');

// Consultas de miembros, roles e invitaciones de una empresa.
@Injectable()
export class MembersRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  // ---------- Miembros ----------

  /** Página de miembros activos; `q` busca por nombre, apellido o email. */
  async listMembersPage(tenantId: number, query: PaginationQuery, tx: Executor = this.db) {
    const filters = [eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, 'active')];
    if (query.q) {
      const p = likePattern(query.q);
      filters.push(or(ilike(users.firstName, p), ilike(users.lastName, p), ilike(users.email, p))!);
    }
    const where = and(...filters);
    const [items, [{ total }]] = await Promise.all([
      this.membersQuery(tx)
        .where(where)
        .orderBy(asc(users.firstName), asc(users.lastName), asc(tenantUsers.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(tenantUsers).innerJoin(users, eq(users.id, tenantUsers.userId)).where(where),
    ]);
    return { items, total };
  }

  private membersQuery(tx: Executor) {
    return tx
      .select({
        tenantUserId: tenantUsers.id,
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: roles.name,
        rolePermissions: roles.permissions,
        allShopsAccess: tenantUsers.allShopsAccess,
        // node-pg devuelve bigint[] como texto: se convierte a number en el servicio.
        shopIds: sql<string[]>`coalesce((select array_agg(tus."shop_id") from "tenant_user_shops" tus where tus."tenant_user_id" = "tenant_users"."id"), '{}')`,
        lastLoginAt: users.lastLoginAt,
        joinedAt: tenantUsers.createdAt,
      })
      .from(tenantUsers)
      .innerJoin(users, eq(users.id, tenantUsers.userId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .$dynamic();
  }

  async findMember(tenantId: number, tenantUserId: number, tx: Executor = this.db) {
    const [member] = await tx
      .select({
        tenantUserId: tenantUsers.id,
        userId: tenantUsers.userId,
        role: roles.name,
        rolePermissions: roles.permissions,
      })
      .from(tenantUsers)
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.id, tenantUserId)))
      .limit(1);
    return member;
  }

  async isMember(tenantId: number, userId: number, tx: Executor = this.db): Promise<boolean> {
    const [row] = await tx
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .limit(1);
    return !!row;
  }

  /** Dueños activos de la empresa (nunca puede quedar en 0). Bloquea las filas para evitar carreras. */
  async countOwners(tenantId: number, tx: Executor = this.db): Promise<number> {
    const rows = await tx
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, 'active'), eq(roles.name, 'OWNER')))
      .for('update', { of: tenantUsers });
    return rows.length;
  }

  async updateMembership(tenantUserId: number, values: { roleId: number; allShopsAccess: boolean }, tx: Executor = this.db) {
    await tx.update(tenantUsers).set(values).where(eq(tenantUsers.id, tenantUserId));
  }

  /** Reemplaza las tiendas permitidas de un miembro. */
  async replaceShopAccess(tenantId: number, tenantUserId: number, shopIds: number[], tx: Executor = this.db) {
    await tx.delete(tenantUserShops).where(eq(tenantUserShops.tenantUserId, tenantUserId));
    if (shopIds.length > 0) {
      await tx.insert(tenantUserShops).values(shopIds.map((shopId) => ({ tenantId, tenantUserId, shopId })));
    }
  }

  async deleteMembership(tenantUserId: number, tx: Executor = this.db) {
    await tx.delete(tenantUsers).where(eq(tenantUsers.id, tenantUserId));
  }

  async insertMembership(values: typeof tenantUsers.$inferInsert, tx: Executor = this.db) {
    const [row] = await tx.insert(tenantUsers).values(values).returning({ id: tenantUsers.id });
    return row;
  }

  /** De la lista, solo los ids de tiendas que pertenecen a la empresa. */
  async existingShopIds(tenantId: number, shopIds: number[], tx: Executor = this.db): Promise<number[]> {
    if (shopIds.length === 0) return [];
    const rows = await tx
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), inArray(shops.id, shopIds)));
    return rows.map((r) => r.id);
  }

  // ---------- Roles ----------

  /** Página de roles de la empresa (Dueño primero); `q` busca por nombre o descripción. */
  async listRolesPage(tenantId: number, query: PaginationQuery, tx: Executor = this.db) {
    const filters = [or(isNull(roles.tenantId), eq(roles.tenantId, tenantId))!];
    if (query.q) filters.push(or(ilike(roles.name, likePattern(query.q)), ilike(roles.description, likePattern(query.q)))!);
    const where = and(...filters);
    const [items, [{ total }]] = await Promise.all([
      this.rolesQuery(tenantId, tx)
        .where(where)
        .orderBy(sql`${roles.tenantId} nulls first`, asc(roles.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(roles).where(where),
    ]);
    return { items, total };
  }

  /** Todos los roles de la empresa (selectores al invitar o editar un miembro). */
  roleOptions(tenantId: number, tx: Executor = this.db) {
    return tx
      .select({ id: roles.id, name: roles.name, description: roles.description, permissions: roles.permissions, tenantId: roles.tenantId })
      .from(roles)
      .where(or(isNull(roles.tenantId), eq(roles.tenantId, tenantId)))
      .orderBy(sql`${roles.tenantId} nulls first`, asc(roles.id));
  }

  private rolesQuery(tenantId: number, tx: Executor) {
    return tx
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        permissions: roles.permissions,
        tenantId: roles.tenantId,
        // Columnas calificadas a mano: sin joins, Drizzle escribiría `id` a secas y dentro de la
        // subconsulta se resolvería contra tenant_users (contaba mal).
        membersCount: sql<number>`(select count(*)::int from "tenant_users" tu where tu."role_id" = "roles"."id" and tu."tenant_id" = ${tenantId})`,
      })
      .from(roles)
      .$dynamic();
  }

  /** Rol por id, global o de la empresa (nunca de otra empresa). */
  async findRoleById(tenantId: number, roleId: number, tx: Executor = this.db) {
    const [role] = await tx
      .select({ id: roles.id, name: roles.name, permissions: roles.permissions, tenantId: roles.tenantId })
      .from(roles)
      .where(and(eq(roles.id, roleId), or(isNull(roles.tenantId), eq(roles.tenantId, tenantId))))
      .limit(1);
    return role;
  }

  async insertRole(values: typeof roles.$inferInsert, tx: Executor = this.db) {
    const [role] = await tx.insert(roles).values(values).returning({ id: roles.id });
    return role;
  }

  async updateRole(
    tenantId: number,
    roleId: number,
    values: Pick<typeof roles.$inferInsert, 'name' | 'description' | 'permissions'>,
    tx: Executor = this.db,
  ) {
    await tx.update(roles).set(values).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
  }

  async deleteRole(tenantId: number, roleId: number, tx: Executor = this.db) {
    await tx.delete(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
  }

  /** ¿Lo usan miembros o invitaciones pendientes? (entonces no se puede borrar) */
  async roleUsage(roleId: number, tx: Executor = this.db): Promise<{ members: number; invitations: number }> {
    const [row] = await tx.execute<{ members: number; invitations: number }>(sql`
      select
        (select count(*)::int from ${tenantUsers} where ${tenantUsers.roleId} = ${roleId}) as members,
        (select count(*)::int from ${tenantInvitations} where ${tenantInvitations.roleId} = ${roleId} and ${tenantInvitations.status} = 'pending') as invitations
    `).then((r) => r.rows);
    return row;
  }

  async findRole(tenantId: number, name: string, tx: Executor = this.db) {
    const [role] = await tx
      .select({ id: roles.id, name: roles.name, permissions: roles.permissions })
      .from(roles)
      .where(and(eq(roles.name, name), or(isNull(roles.tenantId), eq(roles.tenantId, tenantId))))
      .orderBy(sql`${roles.tenantId} nulls last`) // un rol propio tiene prioridad sobre el global
      .limit(1);
    return role;
  }

  // ---------- Invitaciones ----------

  private invitationColumns() {
    return {
      id: tenantInvitations.id,
      tenantId: tenantInvitations.tenantId,
      email: tenantInvitations.email,
      roleId: tenantInvitations.roleId,
      role: roles.name,
      rolePermissions: roles.permissions,
      shopIds: tenantInvitations.shopIds,
      status: tenantInvitations.status,
      expiresAt: tenantInvitations.expiresAt,
      createdAt: tenantInvitations.createdAt,
      invitedBy: sql<string>`${inviter.firstName} || ' ' || ${inviter.lastName}`,
    };
  }

  /** Página de invitaciones pendientes (más recientes primero); `q` busca por email. */
  async listInvitationsPage(tenantId: number, query: PaginationQuery, tx: Executor = this.db) {
    const filters = [eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.status, 'pending')];
    if (query.q) filters.push(ilike(tenantInvitations.email, likePattern(query.q)));
    const where = and(...filters);
    const [items, [{ total }]] = await Promise.all([
      tx
        .select(this.invitationColumns())
        .from(tenantInvitations)
        .innerJoin(roles, eq(roles.id, tenantInvitations.roleId))
        .innerJoin(inviter, eq(inviter.id, tenantInvitations.invitedByUserId))
        .where(where)
        .orderBy(desc(tenantInvitations.createdAt), desc(tenantInvitations.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx.select({ total: count() }).from(tenantInvitations).where(where),
    ]);
    return { items, total };
  }

  async findInvitation(tenantId: number, invitationId: number, tx: Executor = this.db) {
    const [row] = await tx
      .select(this.invitationColumns())
      .from(tenantInvitations)
      .innerJoin(roles, eq(roles.id, tenantInvitations.roleId))
      .innerJoin(inviter, eq(inviter.id, tenantInvitations.invitedByUserId))
      .where(and(eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.id, invitationId)))
      .limit(1);
    return row;
  }

  async findPendingInvitationByEmail(tenantId: number, email: string, tx: Executor = this.db) {
    const [row] = await tx
      .select({ id: tenantInvitations.id, expiresAt: tenantInvitations.expiresAt })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.email, email),
          eq(tenantInvitations.status, 'pending'),
        ),
      )
      .limit(1);
    return row;
  }

  /** Invitación por el hash de su token, con los datos de la empresa (pantalla pública). */
  async findInvitationByTokenHash(tokenHash: string, tx: Executor = this.db, lock = false) {
    const query = tx
      .select({
        ...this.invitationColumns(),
        slug: tenants.slug,
        companyName: tenants.companyName,
        tenantStatus: tenants.status,
      })
      .from(tenantInvitations)
      .innerJoin(tenants, eq(tenants.id, tenantInvitations.tenantId))
      .innerJoin(roles, eq(roles.id, tenantInvitations.roleId))
      .innerJoin(inviter, eq(inviter.id, tenantInvitations.invitedByUserId))
      .where(eq(tenantInvitations.tokenHash, tokenHash))
      .limit(1);
    const [row] = lock ? await query.for('update', { of: tenantInvitations }) : await query;
    return row;
  }

  async insertInvitation(values: typeof tenantInvitations.$inferInsert, tx: Executor = this.db) {
    const [row] = await tx.insert(tenantInvitations).values(values).returning({ id: tenantInvitations.id });
    return row;
  }

  async updateInvitation(
    invitationId: number,
    values: Partial<Pick<typeof tenantInvitations.$inferInsert, 'status' | 'tokenHash' | 'expiresAt' | 'acceptedAt'>>,
    tx: Executor = this.db,
  ) {
    await tx.update(tenantInvitations).set(values).where(eq(tenantInvitations.id, invitationId));
  }
}
