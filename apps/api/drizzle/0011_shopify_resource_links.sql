CREATE TABLE "shopify_resource_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shopify_resource_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"shop_id" bigint NOT NULL,
	"resource_type" varchar(30) NOT NULL,
	"erp_id" bigint NOT NULL,
	"shopify_gid" varchar(255) NOT NULL,
	"shopify_legacy_id" bigint,
	"remote_url" varchar(1000),
	"sync_status" varchar(20) DEFAULT 'synced' NOT NULL,
	"erp_version_synced" integer,
	"shopify_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"last_error" text,
	"unlinked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopify_resource_links" ADD CONSTRAINT "shopify_resource_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_resource_links" ADD CONSTRAINT "shopify_resource_links_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopify_resource_links_shop_gid_uq" ON "shopify_resource_links" USING btree ("shop_id","shopify_gid");--> statement-breakpoint
CREATE UNIQUE INDEX "shopify_resource_links_shop_type_erp_uq" ON "shopify_resource_links" USING btree ("shop_id","resource_type","erp_id");--> statement-breakpoint
CREATE INDEX "shopify_resource_links_tenant_type_erp_idx" ON "shopify_resource_links" USING btree ("tenant_id","resource_type","erp_id");--> statement-breakpoint
CREATE INDEX "shopify_resource_links_shop_status_idx" ON "shopify_resource_links" USING btree ("shop_id","sync_status");