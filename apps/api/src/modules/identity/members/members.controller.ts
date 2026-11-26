import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AcceptInvitationData,
  type AcceptInvitationResponse,
  acceptInvitationSchema,
  type CreatedInvitationResponse,
  type InvitationPreviewResponse,
  type InvitationResponse,
  type InviteMemberData,
  inviteMemberSchema,
  type MemberResponse,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type RoleOptionResponse,
  type RoleData,
  type RoleResponse,
  roleInputSchema,
  type UpdateMemberData,
  updateMemberSchema,
} from '@erp/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import type { Env } from '../../../config/env.schema.js';
import { CurrentAuth, ReqMeta } from '../../../shared/http/current-auth.decorator.js';
import { Public } from '../../../shared/http/public.decorator.js';
import { AUTH_LIMITS } from '../../../shared/http/rate-limit.js';
import type { AuthContext, RequestMeta, TenantContext } from '../../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { setSessionCookie } from '../auth/session-cookie.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';
import { RolesService } from './roles.service.js';

const idSchema = z.coerce.number().int().positive();
const tokenSchema = z.string().min(20).max(100);

@ApiTags('members')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@RequirePermission('users:manage')
@Controller('tenants/:tenant/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Miembros de la empresa, paginados (?page, ?pageSize, ?q)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Paginated<MemberResponse>> {
    return this.members.list(tenant, auth.user.id, query);
  }

  @Patch(':tenantUserId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cambiar rol y tiendas de un miembro' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('tenantUserId', { schema: idSchema }) tenantUserId: number,
    @Body({ schema: updateMemberSchema }) body: UpdateMemberData,
  ): Promise<void> {
    return this.members.update(tenant, auth.user.id, tenantUserId, body);
  }

  @Delete(':tenantUserId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar a un miembro de la empresa' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('tenantUserId', { schema: idSchema }) tenantUserId: number,
  ): Promise<void> {
    return this.members.remove(tenant, auth.user.id, tenantUserId);
  }
}

@ApiTags('members')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Roles de la empresa, paginados (?page, ?pageSize, ?q)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Paginated<RoleResponse>> {
    return this.roles.list(tenant, query);
  }

  // Ruta estática antes de las dinámicas (:roleId).
  @Get('options')
  @ApiOperation({ summary: 'Todos los roles (sin paginar) para selectores' })
  options(@CurrentTenant() tenant: TenantContext): Promise<RoleOptionResponse[]> {
    return this.roles.options(tenant);
  }

  @Post()
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Crear un rol propio de la empresa' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: roleInputSchema }) body: RoleData,
  ): Promise<void> {
    return this.roles.create(tenant, auth.user.id, body);
  }

  @Patch(':roleId')
  @HttpCode(204)
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Editar un rol propio (afecta a sus miembros al instante)' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('roleId', { schema: idSchema }) roleId: number,
    @Body({ schema: roleInputSchema }) body: RoleData,
  ): Promise<void> {
    return this.roles.update(tenant, auth.user.id, roleId, body);
  }

  @Delete(':roleId')
  @HttpCode(204)
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Eliminar un rol propio que no esté en uso' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('roleId', { schema: idSchema }) roleId: number,
  ): Promise<void> {
    return this.roles.remove(tenant, auth.user.id, roleId);
  }
}

@ApiTags('members')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@RequirePermission('users:manage')
@Controller('tenants/:tenant/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'Invitaciones pendientes, paginadas (?page, ?pageSize, ?q)' })
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Paginated<InvitationResponse>> {
    return this.invitations.list(tenant, query);
  }

  @Post()
  @ApiOperation({ summary: 'Invitar a una persona (devuelve el link una sola vez)' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body({ schema: inviteMemberSchema }) body: InviteMemberData,
  ): Promise<CreatedInvitationResponse> {
    return this.invitations.create(tenant, auth.user.id, body);
  }

  @Post(':id/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar un link nuevo (invalida el anterior)' })
  resend(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', { schema: idSchema }) id: number,
  ): Promise<CreatedInvitationResponse> {
    return this.invitations.resend(tenant, auth.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancelar una invitación pendiente' })
  revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', { schema: idSchema }) id: number,
  ): Promise<void> {
    return this.invitations.revoke(tenant, auth.user.id, id);
  }
}

/** Rutas públicas: la persona invitada aún no tiene sesión. */
@ApiTags('members')
@Public()
@Controller('invitations')
export class PublicInvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get(':token')
  @Throttle({ default: AUTH_LIMITS.login })
  @ApiOperation({ summary: 'Ver una invitación (pantalla /invite/[token])' })
  preview(@Param('token', { schema: tokenSchema }) token: string): Promise<InvitationPreviewResponse> {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @Throttle({ default: AUTH_LIMITS.login })
  @ApiOperation({ summary: 'Aceptar la invitación e iniciar sesión' })
  async accept(
    @Param('token', { schema: tokenSchema }) token: string,
    @Body({ schema: acceptInvitationSchema }) body: AcceptInvitationData,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AcceptInvitationResponse> {
    const result = await this.invitations.accept(token, body, meta);
    setSessionCookie(res, result.token, result.expiresAt, this.config.get('NODE_ENV', { infer: true }) === 'production');
    return { slug: result.slug };
  }
}
