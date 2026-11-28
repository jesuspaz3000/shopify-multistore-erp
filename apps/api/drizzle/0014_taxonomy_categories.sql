CREATE TABLE "taxonomy_categories" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"parent_id" varchar(100),
	"level" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"is_leaf" boolean NOT NULL,
	"version" varchar(20) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "taxonomy_categories_parent_idx" ON "taxonomy_categories" USING btree ("parent_id","name");