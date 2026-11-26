import { createParamDecorator, type ExecutionContext, InternalServerErrorException, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../http/request-context.js';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/** Exige un permiso del rol del usuario en la empresa de la URL (lo verifica TenantGuard). */
export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/** Inyecta la empresa de la URL ya validada por TenantGuard. */
export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  // Si falta, el controller olvidó @UseGuards(TenantGuard): es un error de programación.
  if (!req.tenant) throw new InternalServerErrorException('TenantGuard no aplicado a esta ruta');
  return req.tenant;
});
