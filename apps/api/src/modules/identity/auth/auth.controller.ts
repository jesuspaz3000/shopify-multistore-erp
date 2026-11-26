import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthConfigResponse,
  type LoginInput,
  loginSchema,
  type MeResponse,
  type RegisterInput,
  registerSchema,
} from '@erp/contracts';
import type { Response } from 'express';
import type { Env } from '../../../config/env.schema.js';
import { CurrentAuth, ReqMeta } from '../../../shared/http/current-auth.decorator.js';
import { Public } from '../../../shared/http/public.decorator.js';
import { AUTH_LIMITS } from '../../../shared/http/rate-limit.js';
import type { AuthContext, RequestMeta } from '../../../shared/http/request-context.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secureCookies() {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Opciones de inicio de sesión disponibles (registro público, Google)' })
  getConfig(): AuthConfigResponse {
    return this.auth.getConfig();
  }

  @Public()
  @Post('register')
  @Throttle({ default: AUTH_LIMITS.register })
  @ApiOperation({ summary: 'Registrar una empresa nueva y su dueño (solo si ALLOW_SIGNUP=true)' })
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const { token, expiresAt, me } = await this.auth.register(body, meta);
    setSessionCookie(res, token, expiresAt, this.secureCookies);
    return me;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: AUTH_LIMITS.login })
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const { token, expiresAt, me } = await this.auth.login(body, meta);
    setSessionCookie(res, token, expiresAt, this.secureCookies);
    return me;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(auth);
    clearSessionCookie(res, this.secureCookies);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Usuario autenticado y empresas a las que pertenece' })
  me(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    return this.auth.me(auth.user.id);
  }
}
