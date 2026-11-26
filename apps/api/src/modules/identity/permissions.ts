import { OWNER_ROLE, PERMISSION_CODES } from '@erp/contracts';

// El catálogo de permisos vive en @erp/contracts (lo comparten API y Web).
export const PERMISSIONS = PERMISSION_CODES;

export type Permission = (typeof PERMISSIONS)[number] | '*';

export { OWNER_ROLE };

/**
 * Roles con que nace cada empresa. Son COPIAS propias de la empresa (editables y eliminables);
 * el único rol del sistema es el Dueño (OWNER, global, permisos '*', no editable).
 * IMPORTANTE: si cambias esta lista, las empresas existentes no se actualizan solas
 * (drizzle/0003_tenant_default_roles.sql creó las copias iniciales).
 */
export const DEFAULT_TENANT_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: 'Administrador',
    description: 'Todo excepto la configuración de la empresa',
    permissions: PERMISSIONS.filter((p) => p !== 'settings:manage'),
  },
  {
    name: 'Encargado de bodega',
    description: 'Inventario y despachos',
    permissions: ['catalog:read', 'inventory:read', 'inventory:write', 'orders:read', 'fulfillment:read', 'fulfillment:write'],
  },
  {
    name: 'Contabilidad',
    description: 'Lectura de ventas y reportes',
    permissions: ['catalog:read', 'orders:read', 'customers:read', 'reports:read'],
  },
  {
    name: 'Solo lectura',
    description: 'Ver todo, sin modificar',
    permissions: PERMISSIONS.filter((p) => p.endsWith(':read')),
  },
];

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes('*') || granted.includes(required);
}

/**
 * ¿Quien tiene `actor` puede otorgar (o administrar a alguien con) los permisos `target`?
 * Solo si `target` es un subconjunto de los suyos: nadie da ni toca más poder del que tiene.
 * Únicamente un rol con '*' (Dueño) puede otorgar '*'.
 */
export function canGrant(actor: readonly string[], target: readonly string[]): boolean {
  if (actor.includes('*')) return true;
  return !target.includes('*') && target.every((p) => actor.includes(p));
}
