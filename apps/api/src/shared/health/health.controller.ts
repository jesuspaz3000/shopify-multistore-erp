import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import { Public } from '../http/public.decorator.js';

@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /** Liveness: el proceso está vivo (no toca la base de datos). */
  @Get('health')
  @ApiOperation({ summary: 'Liveness: el proceso responde' })
  health() {
    return { status: 'ok' };
  }

  /** Readiness: puede atender requests (la base de datos responde). */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness: la base de datos responde' })
  async ready() {
    try {
      await this.pool.query('select 1');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}
