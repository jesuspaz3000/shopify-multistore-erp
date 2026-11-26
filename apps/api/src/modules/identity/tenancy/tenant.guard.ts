import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_PERMISSION_KEY } from '../../../shared/tenancy/current-tenant.decorator.js';
import { IdentityRepository } from '../identity.repository.js';
import { hasPermission, type Permission } from '../permissions.js';

/**
 * Para rutas /tenants/:tenant/...: verifica que el usuario de la sesión pertenezca a esa empresa
 * (404 si no, para no revelar qué empresas existen) y que su rol tenga el permiso exigido
 * con @RequirePermission (403 si no). Deja la empresa en req.tenant.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repo: IdentityRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const slug = req.params.tenant;
    if (!req.auth || typeof slug !== 'string') throw new NotFoundException('Empresa no encontrada');

    const membership = await this.repo.findMembershipBySlug(req.auth.user.id, slug);
    if (!membership) throw new NotFoundException('Empresa no encontrada');

    const required = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (required && !hasPermission(membership.permissions, required)) {
      throw new ForbiddenException('Tu rol no tiene permiso para esta acción');
    }

    req.tenant = {
      tenantId: membership.tenantId,
      slug: membership.slug,
      tenantUserId: membership.tenantUserId,
      role: membership.role,
      permissions: membership.permissions,
      allowedShopIds: membership.allShopsAccess ? null : await this.repo.allowedShopIds(membership.tenantUserId),
    };
    return true;
  }
}
