CREATE TABLE "locations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(20) DEFAULT 'warehouse' NOT NULL,
	"name" varchar(255) NOT NULL,
	"address1" varchar(255),
	"address2" varchar(255),
	"city" varchar(100),
	"province" varchar(100),
	"province_code" varchar(10),
	"country_code" varchar(2),
	"zip" varchar(20),
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_locations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shop_locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"shop_id" bigint NOT NULL,
	"location_id" bigint NOT NULL,
	"shopify_gid" varchar(255),
	"shopify_legacy_id" bigint,
	"shopify_name" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"fulfills_online_orders" boolean DEFAULT false NOT NULL,
	"ships_inventory" boolean DEFAULT true NOT NULL,
	"has_active_inventory" boolean DEFAULT false NOT NULL,
	"fulfillment_service_handle" varchar(100),
	"local_pickup_enabled" boolean DEFAULT false NOT NULL,
	"stock_sync_mode" varchar(20) DEFAULT 'MIRROR' NOT NULL,
	"stock_percentage" numeric(5, 2),
	"stock_buffer" integer,
	"shopify_updated_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_locations" ADD CONSTRAINT "shop_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_locations" ADD CONSTRAINT "shop_locations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_locations" ADD CONSTRAINT "shop_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_code_uq" ON "locations" USING btree ("tenant_id","code") WHERE "locations"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "locations_tenant_deleted_idx" ON "locations" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_locations_shop_gid_uq" ON "shop_locations" USING btree ("shop_id","shopify_gid");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_locations_shop_location_uq" ON "shop_locations" USING btree ("shop_id","location_id");--> statement-breakpoint
CREATE INDEX "shop_locations_tenant_location_idx" ON "shop_locations" USING btree ("tenant_id","location_id");