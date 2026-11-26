// Nombres visibles de roles y permisos. El único código de sistema es OWNER (Dueño);
// los roles de cada empresa ya tienen nombre legible (Administrador, Vendedor...).
export const roleLabel = (role: string) => (role === 'OWNER' ? 'Dueño' : role);

/** Permisos agrupados por área para la matriz de roles. */
export const PERMISSION_GROUPS: { area: string; permissions: { code: string; label: string }[] }[] = [
  { area: 'Catálogo', permissions: [{ code: 'catalog:read', label: 'Ver' }, { code: 'catalog:write', label: 'Editar' }] },
  { area: 'Inventario', permissions: [{ code: 'inventory:read', label: 'Ver' }, { code: 'inventory:write', label: 'Editar' }] },
  { area: 'Órdenes', permissions: [{ code: 'orders:read', label: 'Ver' }, { code: 'orders:write', label: 'Editar' }] },
  { area: 'Clientes', permissions: [{ code: 'customers:read', label: 'Ver' }, { code: 'customers:write', label: 'Editar' }] },
  { area: 'Despachos', permissions: [{ code: 'fulfillment:read', label: 'Ver' }, { code: 'fulfillment:write', label: 'Editar' }] },
  { area: 'Marketing', permissions: [{ code: 'marketing:read', label: 'Ver' }, { code: 'marketing:write', label: 'Editar' }] },
  { area: 'Reportes', permissions: [{ code: 'reports:read', label: 'Ver' }] },
  {
    area: 'Administración',
    permissions: [
      { code: 'shops:manage', label: 'Tiendas' },
      { code: 'users:manage', label: 'Usuarios' },
      { code: 'settings:manage', label: 'Configuración' },
    ],
  },
];

/** Resumen legible por área: ["Catálogo: Ver", "Órdenes: Ver y Editar", ...]. */
export function summarizePermissions(permissions: readonly string[]): string[] {
  if (permissions.includes('*')) return ['Todos los permisos'];
  return PERMISSION_GROUPS.flatMap((g) => {
    const granted = g.permissions.filter((p) => permissions.includes(p.code)).map((p) => p.label);
    return granted.length > 0 ? [`${g.area}: ${granted.join(' y ')}`] : [];
  });
}
