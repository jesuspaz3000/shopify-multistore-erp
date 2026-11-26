import type { TenantMembership } from '@erp/contracts';

/**
 * ¿El rol del usuario en esta empresa tiene el permiso? Solo sirve para mostrar u ocultar
 * acciones en la UI: la API vuelve a verificarlo en cada request.
 */
export function can(membership: Pick<TenantMembership, 'permissions'>, permission: string): boolean {
  return membership.permissions.includes('*') || membership.permissions.includes(permission);
}
