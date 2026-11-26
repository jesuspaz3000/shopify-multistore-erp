import { z } from 'zod';

/** Catálogo de permisos (fuente única para API y Web). '*' = todos (solo el rol Dueño). */
export const PERMISSION_CODES = [
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
export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Único rol del sistema: tiene todos los permisos y no se puede editar ni eliminar. */
export const OWNER_ROLE = 'OWNER';

/** Nombres que ningún rol de empresa puede usar (evita hacerse pasar por el Dueño). */
const RESERVED_ROLE_NAMES = ['OWNER', 'DUEÑO', 'DUENO'];

export const roleNameInputSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(50, 'Máximo 50 caracteres')
  .refine((n) => !RESERVED_ROLE_NAMES.includes(n.toUpperCase()), 'Ese nombre está reservado para el rol Dueño');

export const roleInputSchema = z.object({
  name: roleNameInputSchema,
  description: z.string().trim().max(255).optional(),
  permissions: z
    .array(z.enum(PERMISSION_CODES, 'Permiso desconocido'))
    .min(1, 'Elige al menos un permiso')
    .transform((list) => [...new Set(list)]),
});
export type RoleInput = z.input<typeof roleInputSchema>;
export type RoleData = z.output<typeof roleInputSchema>;
