import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { media, productMedia } from '../infrastructure/persistence/catalog.schema.js';

type Executor = Database | Tx;
export type MediaRow = typeof media.$inferSelect;

@Injectable()
export class MediaRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findById(tenantId: number, mediaId: number, tx: Executor = this.db): Promise<MediaRow | undefined> {
    const [row] = await tx
      .select()
      .from(media)
      .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)))
      .limit(1);
    return row;
  }

  /** Mismo archivo ya subido por la empresa (evita duplicados). */
  async findByChecksum(tenantId: number, checksum: string, tx: Executor = this.db): Promise<MediaRow | undefined> {
    const [row] = await tx
      .select()
      .from(media)
      .where(and(eq(media.tenantId, tenantId), eq(media.checksumSha256, checksum)))
      .limit(1);
    return row;
  }

  async insert(values: typeof media.$inferInsert, tx: Executor = this.db): Promise<MediaRow> {
    const [row] = await tx.insert(media).values(values).returning();
    return row;
  }

  /** De los ids indicados, los que son imágenes de la empresa. */
  async existingIds(tenantId: number, ids: number[], tx: Executor = this.db): Promise<Set<number>> {
    if (ids.length === 0) return new Set();
    const rows = await tx
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.tenantId, tenantId), inArray(media.id, ids)));
    return new Set(rows.map((r) => r.id));
  }

  /** Reemplaza las imágenes del producto (en orden) y actualiza su texto alternativo. */
  async replaceProductMedia(tenantId: number, productId: number, items: { id: number; alt: string | null }[], tx: Tx) {
    await tx.delete(productMedia).where(and(eq(productMedia.tenantId, tenantId), eq(productMedia.productId, productId)));
    if (items.length === 0) return;
    await tx.insert(productMedia).values(items.map((m, i) => ({ tenantId, productId, mediaId: m.id, position: i + 1 })));
    for (const m of items) {
      await tx
        .update(media)
        .set({ alt: m.alt })
        .where(and(eq(media.tenantId, tenantId), eq(media.id, m.id)));
    }
  }

  /** Imágenes del producto en orden. */
  productMedia(tenantId: number, productId: number, tx: Executor = this.db) {
    return tx
      .select({ media })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(and(eq(productMedia.tenantId, tenantId), eq(productMedia.productId, productId)))
      .orderBy(asc(productMedia.position))
      .then((rows) => rows.map((r) => r.media));
  }
}
