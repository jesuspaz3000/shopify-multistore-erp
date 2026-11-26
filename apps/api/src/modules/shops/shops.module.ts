import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ShopsController } from './shops.controller.js';
import { ShopsRepository } from './shops.repository.js';
import { ShopsService } from './shops.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [ShopsController],
  providers: [ShopsRepository, ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
