DROP INDEX "shops_tenant_handle_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "shops_tenant_handle_uq" ON "shops" USING btree ("tenant_id","handle");