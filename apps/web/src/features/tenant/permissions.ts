import type { TenantMembership } from '@erp/contracts';

/**
 * ¿El rol del usuario en esta empresa tiene el permiso? Solo sirve para mostrar u ocultar
 * acciones en la UI: la API vuelve a verificarlo en cada request.
 */
export function can(membership: Pick<TenantMembership, 'permissions'>, permission: string): boolean {
  return membership.permissions.includes('*') || membership.permissions.includes(permission);
}

/** ¿Puede otorgar (o administrar a alguien con) esos permisos? Misma regla que la API. */
export function canGrant(actor: readonly string[], target: readonly string[]): boolean {
  if (actor.includes('*')) return true;
  return !target.includes('*') && target.every((p) => actor.includes(p));
}
