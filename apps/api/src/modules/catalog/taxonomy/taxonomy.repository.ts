import { Inject, Injectable } from '@nestjs/common';
import { likePattern } from '@erp/contracts';
import { and, asc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { DB, type Database, type Tx } from '../../../shared/database/database.module.js';
import { searchText, type TaxonomyEntry } from './taxonomy-parser.js';
import { taxonomyCategories } from './taxonomy.schema.js';

type Executor = Database | Tx;
export type TaxonomyRow = typeof taxonomyCategories.$inferSelect;

const SEARCH_LIMIT = 30;
const BATCH = 2000;

@Injectable()
export class TaxonomyRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Hijas de una categoría (o las raíces), por nombre. */
  children(parentId: string | null, tx: Executor = this.db): Promise<TaxonomyRow[]> {
    return tx
      .select()
      .from(taxonomyCategories)
      .where(parentId ? eq(taxonomyCategories.parentId, parentId) : isNull(taxonomyCategories.parentId))
      .orderBy(asc(taxonomyCategories.name));
  }

  /**
   * Búsqueda por palabras, sin tildes ni mayúsculas: todas deben aparecer en la ruta completa.
   * Orden: más palabras en el PROPIO nombre, nombre más corto (lo más parecido a lo buscado),
   * menos profundo y alfabético. El índice de trigramas (pg_trgm) hace rápido el LIKE '%...%'.
   */
  search(q: string, tx: Executor = this.db): Promise<TaxonomyRow[]> {
    const words = searchText(q).split(/\s+/).filter(Boolean).slice(0, 6);
    const nameHits = sql.join(
      words.map((w) => sql`(${taxonomyCategories.searchName} like ${likePattern(w)})::int`),
      sql` + `,
    );
    return tx
      .select()
      .from(taxonomyCategories)
      .where(and(...words.map((w) => like(taxonomyCategories.searchFullName, likePattern(w)))))
      .orderBy(sql`(${nameHits}) desc`, sql`length(${taxonomyCategories.name})`, asc(taxonomyCategories.level), asc(taxonomyCategories.name))
      .limit(SEARCH_LIMIT);
  }
  async findByIds(ids: string[], tx: Executor = this.db): Promise<Map<string, TaxonomyRow>> {
    if (ids.length === 0) return new Map();
    const rows = await tx.select().from(taxonomyCategories).where(inArray(taxonomyCategories.id, ids));
    return new Map(rows.map((r) => [r.id, r]));
  }

  async count(tx: Executor = this.db): Promise<number> {
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(taxonomyCategories);
    return row.n;
  }

  /**
   * Carga una versión completa: inserta o actualiza todas sus categorías. Las que ya no están en la
   * versión nueva se conservan (algún producto puede usarlas; Shopify las archiva, no las borra).
   */
  async upsertAll(entries: TaxonomyEntry[], version: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH).map((e) => ({ ...e, version, updatedAt: new Date() }));
        await tx
          .insert(taxonomyCategories)
          .values(batch)
          .onConflictDoUpdate({
            target: taxonomyCategories.id,
            set: {
              parentId: sql`excluded.parent_id`,
              level: sql`excluded.level`,
              name: sql`excluded.name`,
              fullName: sql`excluded.full_name`,
              isLeaf: sql`excluded.is_leaf`,
              searchName: sql`excluded.search_name`,
              searchFullName: sql`excluded.search_full_name`,
              version: sql`excluded.version`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
    });
  }
}
