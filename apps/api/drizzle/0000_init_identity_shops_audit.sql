CREATE TABLE "oidc_login_states" (
	"state_hash" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(30) NOT NULL,
	"code_verifier" varchar(128) NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"redirect_to" varchar(500),
	"link_user_id" bigint,
	"invitation_id" bigint,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint,
	"name" varchar(50) NOT NULL,
	"description" varchar(255),
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_name_uq" UNIQUE NULLS NOT DISTINCT("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"email" varchar(255) NOT NULL,
	"role_id" bigint NOT NULL,
	"shop_ids" bigint[],
	"token_hash" varchar(64) NOT NULL,
	"invited_by_user_id" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invitations_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"all_shops_access" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_users_tenant_user_uq" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" varchar(63) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"billing_email" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'pro' NOT NULL,
	"reporting_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_identities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"hosted_domain" varchar(255),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identities_provider_sub_uq" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "user_identities_user_provider_uq" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"auth_method" varchar(20) NOT NULL,
	"active_tenant_id" bigint,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"type" varchar(30) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"is_superuser" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shops_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"handle" varchar(63) NOT NULL,
	"shopify_gid" varchar(255),
	"shopify_legacy_id" bigint,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"contact_email" varchar(255),
	"primary_domain" varchar(255),
	"myshopify_domain" varchar(255),
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"enabled_presentment_currencies" text[],
	"money_format" varchar(50),
	"iana_timezone" varchar(100),
	"plan_display_name" varchar(100),
	"country_code" varchar(2),
	"taxes_included" boolean DEFAULT false NOT NULL,
	"primary_location_id" bigint,
	"api_version" varchar(10),
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"encryption_key_version" integer DEFAULT 1 NOT NULL,
	"granted_scopes" text[],
	"status" varchar(20) DEFAULT 'pending_connection' NOT NULL,
	"installed_at" timestamp with time zone,
	"uninstalled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_shopifyGid_unique" UNIQUE("shopify_gid"),
	CONSTRAINT "shops_shopifyLegacyId_unique" UNIQUE("shopify_legacy_id"),
	CONSTRAINT "shops_myshopifyDomain_unique" UNIQUE("myshopify_domain")
);
--> statement-breakpoint
CREATE TABLE "tenant_user_shops" (
	"tenant_id" bigint NOT NULL,
	"tenant_user_id" bigint NOT NULL,
	"shop_id" bigint NOT NULL,
	"role_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_user_shops_tenant_user_id_shop_id_pk" PRIMARY KEY("tenant_user_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint,
	"shop_id" bigint,
	"user_id" bigint,
	"source" varchar(20) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" bigint,
	"action" varchar(30) NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oidc_login_states" ADD CONSTRAINT "oidc_login_states_link_user_id_users_id_fk" FOREIGN KEY ("link_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_login_states" ADD CONSTRAINT "oidc_login_states_invitation_id_tenant_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."tenant_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_active_tenant_id_tenants_id_fk" FOREIGN KEY ("active_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_user_shops" ADD CONSTRAINT "tenant_user_shops_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_user_shops" ADD CONSTRAINT "tenant_user_shops_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_user_shops" ADD CONSTRAINT "tenant_user_shops_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_user_shops" ADD CONSTRAINT "tenant_user_shops_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oidc_login_states_expires_idx" ON "oidc_login_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tenant_invitations_tenant_email_idx" ON "tenant_invitations" USING btree ("tenant_id","email","status");--> statement-breakpoint
CREATE INDEX "tenant_users_user_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_tokens_user_type_idx" ON "user_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "shops_tenant_status_idx" ON "shops" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "shops_tenant_handle_idx" ON "shops" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE INDEX "tenant_user_shops_tenant_shop_idx" ON "tenant_user_shops" USING btree ("tenant_id","shop_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_entity_idx" ON "audit_logs" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");