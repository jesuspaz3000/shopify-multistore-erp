-- Roles editables por empresa.
-- Antes: 5 roles globales compartidos por todas las empresas (editar uno afectaba a todas).
-- Ahora: el Dueño (OWNER) es el único rol del sistema; cada empresa tiene su PROPIA copia de
-- Administrador, Encargado de bodega, Contabilidad y Solo lectura, que puede editar o eliminar.
-- Debe coincidir con DEFAULT_TENANT_ROLES en src/modules/identity/permissions.ts.
-- (Sin tablas temporales: cada sentencia es autónoma, funciona con o sin transacción envolvente.)

-- 1) Copia de cada rol predefinido (no Dueño) para cada empresa existente.
INSERT INTO "roles" ("tenant_id", "name", "description", "permissions")
SELECT t."id", m.new_name, m.description, g."permissions"
FROM "tenants" t
CROSS JOIN (VALUES
  ('ADMIN', 'Administrador', 'Todo excepto la configuración de la empresa'),
  ('WAREHOUSE_MANAGER', 'Encargado de bodega', 'Inventario y despachos'),
  ('ACCOUNTANT', 'Contabilidad', 'Lectura de ventas y reportes'),
  ('VIEWER', 'Solo lectura', 'Ver todo, sin modificar')
) AS m(old_name, new_name, description)
JOIN "roles" g ON g."tenant_id" IS NULL AND g."name" = m.old_name
ON CONFLICT ON CONSTRAINT "roles_tenant_name_uq" DO NOTHING;
--> statement-breakpoint

-- 2) Reasignar membresías, accesos por tienda e invitaciones a la copia de SU empresa.
UPDATE "tenant_users" tu SET "role_id" = c."id"
FROM "roles" g
JOIN (VALUES ('ADMIN', 'Administrador'), ('WAREHOUSE_MANAGER', 'Encargado de bodega'), ('ACCOUNTANT', 'Contabilidad'), ('VIEWER', 'Solo lectura'))
  AS m(old_name, new_name) ON m.old_name = g."name"
JOIN "roles" c ON c."name" = m.new_name
WHERE tu."role_id" = g."id" AND g."tenant_id" IS NULL AND c."tenant_id" = tu."tenant_id";
--> statement-breakpoint
UPDATE "tenant_user_shops" tus SET "role_id" = c."id"
FROM "roles" g
JOIN (VALUES ('ADMIN', 'Administrador'), ('WAREHOUSE_MANAGER', 'Encargado de bodega'), ('ACCOUNTANT', 'Contabilidad'), ('VIEWER', 'Solo lectura'))
  AS m(old_name, new_name) ON m.old_name = g."name"
JOIN "roles" c ON c."name" = m.new_name
WHERE tus."role_id" = g."id" AND g."tenant_id" IS NULL AND c."tenant_id" = tus."tenant_id";
--> statement-breakpoint
UPDATE "tenant_invitations" ti SET "role_id" = c."id"
FROM "roles" g
JOIN (VALUES ('ADMIN', 'Administrador'), ('WAREHOUSE_MANAGER', 'Encargado de bodega'), ('ACCOUNTANT', 'Contabilidad'), ('VIEWER', 'Solo lectura'))
  AS m(old_name, new_name) ON m.old_name = g."name"
JOIN "roles" c ON c."name" = m.new_name
WHERE ti."role_id" = g."id" AND g."tenant_id" IS NULL AND c."tenant_id" = ti."tenant_id";
--> statement-breakpoint

-- 3) Ya nada apunta a los globales no-Dueño: se eliminan.
DELETE FROM "roles" WHERE "tenant_id" IS NULL AND "name" <> 'OWNER';
--> statement-breakpoint
UPDATE "roles" SET "description" = 'Dueño de la empresa: todos los permisos (no editable)'
WHERE "tenant_id" IS NULL AND "name" = 'OWNER';
