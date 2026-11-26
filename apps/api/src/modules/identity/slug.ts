// Slugs de tenant para la URL: /{slug}/{tienda}/...
// Reservados: coinciden con rutas propias del frontend/API y no pueden ser un tenant.
export const RESERVED_SLUGS = new Set([
  'login',
  'register',
  'select-tenant',
  'invite',
  'forgot-password',
  'reset-password',
  'api',
  'docs',
  'health',
  'ready',
  'admin',
  'settings',
  'all',
  '_next',
]);

const MAX_BASE_LENGTH = 50;

/** "Tienda Ñandú & Cía." -> "tienda-nandu-cia" */
export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');
  return slug.length >= 2 ? slug : 'empresa';
}

/** Primer slug libre: base, base-2, base-3... (evitando los reservados). */
export function nextAvailableSlug(base: string, taken: ReadonlySet<string>): string {
  if (!RESERVED_SLUGS.has(base) && !taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
