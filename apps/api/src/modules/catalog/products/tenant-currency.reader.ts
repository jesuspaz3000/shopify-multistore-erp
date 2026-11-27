import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../../shared/database/database.module.js';
import { tenants } from '../../identity/identity.schema.js';

/** Moneda de los precios de lista y costos maestros: la moneda de reporte de la empresa. */
@Injectable()
export class TenantCurrencyReader {
  constructor(@Inject(DB) private readonly db: Database) {}

  async of(tenantId: number): Promise<string> {
    const [row] = await this.db
      .select({ currency: tenants.reportingCurrency })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return row?.currency ?? 'USD';
  }
}
