// API pública del módulo de identidad.
export { IdentityModule } from './identity.module.js';
export { hasPermission, type Permission } from './permissions.js';
export { TenantGuard } from './tenancy/tenant.guard.js';
export { RESERVED_SLUGS, nextAvailableSlug, slugify } from './slug.js';
