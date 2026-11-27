ALTER TABLE "product_variants" ADD COLUMN "compare_at_price" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "inventory_policy" varchar(10) DEFAULT 'DENY' NOT NULL;