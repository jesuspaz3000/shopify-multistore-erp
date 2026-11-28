import { boolean, index, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tsz } from '../../../shared/database/columns.js';

/**
 * Taxonomía estándar de productos de Shopify (https://github.com/Shopify/product-taxonomy, MIT).
 * Global (igual para todas las empresas); se carga con `npm run taxonomy:import`.
 * `id` es el código corto ("sg-4-17-2-17"); en Shopify el GID es gid://shopify/TaxonomyCategory/{id}.
 */
export const taxonomyCategories = pgTable(
  'taxonomy_categories',
  {
    id: varchar({ length: 100 }).primaryKey(),
    parentId: varchar({ length: 100 }), // null = categoría raíz (vertical)
    level: integer().notNull(), // 0 = raíz
    name: varchar({ length: 255 }).notNull(),
    fullName: text().notNull(), // "Artículos deportivos > ... > Tablas de snowboard"
    isLeaf: boolean().notNull(),
    // Para buscar: en minúsculas y sin tildes ("esqui" encuentra "Esquí"), con índice de trigramas.
    searchName: text().notNull(),
    searchFullName: text().notNull(),
    version: varchar({ length: 20 }).notNull(), // versión de la taxonomía ("2026-11")
    updatedAt: tsz().notNull().defaultNow(),
  },
  (t) => [
    index('taxonomy_categories_parent_idx').on(t.parentId, t.name),
    index('taxonomy_categories_search_trgm_idx').using('gin', sql`${t.searchFullName} gin_trgm_ops`),
  ],
);
