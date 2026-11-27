CREATE TABLE "inventory_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"sku" varchar(255),
	"tracked" boolean DEFAULT true NOT NULL,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"unit_cost" numeric(18, 4),
	"unit_cost_currency" varchar(3),
	"country_code_of_origin" varchar(2),
	"province_code_of_origin" varchar(10),
	"harmonized_system_code" varchar(20),
	"country_harmonized_system_codes" jsonb,
	"weight_value" numeric(12, 4),
	"weight_unit" varchar(10),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option_values" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_option_values_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"option_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"has_variants" boolean DEFAULT true NOT NULL,
	"swatch_color" varchar(20),
	"swatch_image_media_id" bigint,
	"linked_metafield_value" text
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"linked_metafield_namespace" varchar(255),
	"linked_metafield_key" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"sku" varchar(255),
	"barcode" varchar(255),
	"base_price" numeric(18, 4),
	"base_price_currency" varchar(3),
	"position" integer NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"inventory_item_id" bigint NOT NULL,
	"requires_components" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_inventoryItemId_unique" UNIQUE("inventory_item_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"origin_shop_id" bigint,
	"title" varchar(255) NOT NULL,
	"description_html" text,
	"vendor" varchar(255),
	"product_type" varchar(255),
	"category_gid" varchar(255),
	"handle" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"seo_title" varchar(255),
	"seo_description" text,
	"template_suffix" varchar(100),
	"is_gift_card" boolean DEFAULT false NOT NULL,
	"requires_selling_plan" boolean DEFAULT false NOT NULL,
	"has_variants_that_require_components" boolean DEFAULT false NOT NULL,
	"combined_listing_role" varchar(10),
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"tenant_id" bigint NOT NULL,
	"variant_id" bigint NOT NULL,
	"option_value_id" bigint NOT NULL,
	CONSTRAINT "variant_option_values_variant_id_option_value_id_pk" PRIMARY KEY("variant_id","option_value_id")
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_origin_shop_id_shops_id_fk" FOREIGN KEY ("origin_shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_option_value_id_product_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_tenant_sku_idx" ON "inventory_items" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "product_option_values_option_name_uq" ON "product_option_values" USING btree ("option_id","name");--> statement-breakpoint
CREATE INDEX "product_option_values_tenant_product_idx" ON "product_option_values" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_options_product_position_uq" ON "product_options" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_options_tenant_product_idx" ON "product_options" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "product_variants_tenant_product_idx" ON "product_variants" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_tenant_sku_uq" ON "product_variants" USING btree ("tenant_id","sku") WHERE "product_variants"."sku" is not null and "product_variants"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_variants_tenant_barcode_idx" ON "product_variants" USING btree ("tenant_id","barcode");--> statement-breakpoint
CREATE INDEX "product_variants_tenant_deleted_idx" ON "product_variants" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_handle_uq" ON "products" USING btree ("tenant_id","handle") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_tenant_status_idx" ON "products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "products_tenant_vendor_idx" ON "products" USING btree ("tenant_id","vendor");--> statement-breakpoint
CREATE INDEX "products_tenant_deleted_idx" ON "products" USING btree ("tenant_id","deleted_at");