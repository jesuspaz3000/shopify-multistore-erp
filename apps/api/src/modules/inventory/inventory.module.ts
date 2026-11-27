import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { LocationsController } from './locations/locations.controller.js';
import { LocationsRepository } from './locations/locations.repository.js';
import { LocationsService } from './locations/locations.service.js';
import { StockController } from './stock/stock.controller.js';
import { StockRepository } from './stock/stock.repository.js';
import { StockService } from './stock/stock.service.js';

// Módulo de inventario: bodegas (y las tiendas que abastecen), stock por bodega y kardex.
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [LocationsController, StockController],
  providers: [LocationsRepository, LocationsService, StockRepository, StockService],
  exports: [LocationsService, StockService],
})
export class InventoryModule {}
