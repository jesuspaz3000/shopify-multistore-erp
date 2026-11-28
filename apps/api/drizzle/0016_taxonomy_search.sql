-- Búsqueda rápida de categorías: texto en minúsculas y sin tildes con índice de trigramas (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ADD COLUMN "search_name" text;--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ADD COLUMN "search_full_name" text;--> statement-breakpoint
-- Categorías ya cargadas: se calculan aquí (las nuevas las calcula `npm run taxonomy:import`).
UPDATE "taxonomy_categories" SET "search_name" = lower(unaccent("name")), "search_full_name" = lower(unaccent("full_name"));--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ALTER COLUMN "search_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ALTER COLUMN "search_full_name" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "taxonomy_categories_search_trgm_idx" ON "taxonomy_categories" USING gin ("search_full_name" gin_trgm_ops);
