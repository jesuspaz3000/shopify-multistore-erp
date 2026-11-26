-- Roles globales por defecto (tenant_id NULL). Deben coincidir con GLOBAL_ROLES en
-- src/modules/identity/permissions.ts. Idempotente: se puede re-ejecutar sin duplicar.
INSERT INTO "roles" ("tenant_id", "name", "description", "permissions") VALUES
  (NULL, 'OWNER', 'Dueño de la empresa: acceso total', '["*"]'::jsonb),
  (NULL, 'ADMIN', 'Administrador: todo excepto configuración de la empresa',
    '["catalog:read","catalog:write","inventory:read","inventory:write","orders:read","orders:write","customers:read","customers:write","fulfillment:read","fulfillment:write","marketing:read","marketing:write","reports:read","shops:manage","users:manage"]'::jsonb),
  (NULL, 'WAREHOUSE_MANAGER', 'Bodega: inventario y despachos',
    '["catalog:read","inventory:read","inventory:write","orders:read","fulfillment:read","fulfillment:write"]'::jsonb),
  (NULL, 'ACCOUNTANT', 'Contabilidad: lectura de ventas y reportes',
    '["catalog:read","orders:read","customers:read","reports:read"]'::jsonb),
  (NULL, 'VIEWER', 'Solo lectura',
    '["catalog:read","inventory:read","orders:read","customers:read","fulfillment:read","marketing:read","reports:read"]'::jsonb)
ON CONFLICT ON CONSTRAINT "roles_tenant_name_uq" DO NOTHING;
