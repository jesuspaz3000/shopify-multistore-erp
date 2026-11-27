import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { LocationsController } from './locations/locations.controller.js';
import { LocationsRepository } from './locations/locations.repository.js';
import { LocationsService } from './locations/locations.service.js';

// Módulo de inventario. Por ahora: bodegas y su vínculo con las tiendas.
// Pendiente: items, niveles de stock y kardex.
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [LocationsController],
  providers: [LocationsRepository, LocationsService],
  exports: [LocationsService],
})
export class InventoryModule {}
