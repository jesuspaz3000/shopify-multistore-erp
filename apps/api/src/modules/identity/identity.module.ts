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
import { TenantGuard } from './tenancy/tenant.guard.js';
import { TenantProvisioningService } from './tenant-provisioning.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [
    IdentityRepository,
    PasswordService,
    SessionsService,
    AuthService,
    TenantProvisioningService,
    TenantGuard,
    // Guard global de sesión: toda la API exige sesión salvo rutas @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  // TenantGuard + IdentityRepository: los módulos con rutas /tenants/:tenant/... los usan.
  exports: [SessionsService, IdentityRepository, TenantGuard],
})
export class IdentityModule {}
