import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { PasswordService } from './auth/password.service.js';
import { SessionGuard } from './auth/session.guard.js';
import { SessionsService } from './auth/sessions.service.js';
import { IdentityRepository } from './identity.repository.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [
    IdentityRepository,
    PasswordService,
    SessionsService,
    AuthService,
    // Guard global de sesión: toda la API exige sesión salvo rutas @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [SessionsService],
})
export class IdentityModule {}
