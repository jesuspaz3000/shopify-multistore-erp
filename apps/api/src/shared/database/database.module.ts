import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Env } from '../../config/env.schema.js';
import * as schema from './schema/index.js';

export const PG_POOL = Symbol('PG_POOL');
export const DB = Symbol('DB');

export type Database = NodePgDatabase<typeof schema>;
/** Cliente dentro de una transacción (mismo API que Database). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// Pool de PostgreSQL + cliente Drizzle tipado. Los módulos que acceden a datos importan
// DatabaseModule (no es @Global) e inyectan el cliente con @Inject(DB).
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: 10,
        }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool): Database => drizzle(pool, { schema, casing: 'snake_case' }),
    },
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
