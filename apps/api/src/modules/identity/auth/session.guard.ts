import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Env } from '../../../config/env.schema.js';
import { IS_PUBLIC_KEY } from '../../../shared/http/public.decorator.js';
import { SESSION_COOKIE, setSessionCookie } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/**
 * Guard GLOBAL: toda ruta exige sesión salvo las marcadas con @Public().
 * Si hay cookie válida, adjunta req.auth (también en rutas públicas).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);

    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      const result = await this.sessions.validate(token);
      if (result) {
        req.auth = result.context;
        if (result.renewedUntil) {
          const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';
          setSessionCookie(ctx.switchToHttp().getResponse<Response>(), token, result.renewedUntil, secure);
        }
      }
    }

    if (isPublic) return true;
    if (!req.auth) throw new UnauthorizedException('Sesión inválida o expirada');
    return true;
  }
}
