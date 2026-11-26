import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext, RequestMeta } from './request-context.js';

/** Inyecta el AuthContext del usuario autenticado (lanza 401 si no hay sesión). */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.auth) throw new UnauthorizedException('Sesión inválida o expirada');
  return req.auth;
});

/** IP y user agent del request (para sesiones y auditoría). */
export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ipAddress: req.ip, userAgent: req.get('user-agent')?.slice(0, 500) };
});
