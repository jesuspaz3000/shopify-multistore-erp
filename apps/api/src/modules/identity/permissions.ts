// Catálogo de permisos y roles globales por defecto.
// IMPORTANTE: si cambias GLOBAL_ROLES, crea una migración nueva que actualice la tabla roles
// (drizzle/0001_seed_global_roles.sql tiene la versión inicial).

export const PERMISSIONS = [
  'catalog:read',
  'catalog:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'fulfillment:read',
  'fulfillment:write',
  'marketing:read',
  'marketing:write',
  'reports:read',
  'shops:manage',
  'users:manage',
  'settings:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number] | '*';

export const GLOBAL_ROLES = {
  OWNER: ['*'],
  ADMIN: PERMISSIONS.filter((p) => p !== 'settings:manage'),
  WAREHOUSE_MANAGER: ['catalog:read', 'inventory:read', 'inventory:write', 'orders:read', 'fulfillment:read', 'fulfillment:write'],
  ACCOUNTANT: ['catalog:read', 'orders:read', 'customers:read', 'reports:read'],
  VIEWER: PERMISSIONS.filter((p) => p.endsWith(':read')),
} satisfies Record<string, readonly Permission[]>;

export type GlobalRoleName = keyof typeof GLOBAL_ROLES;

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes('*') || granted.includes(required);
}
