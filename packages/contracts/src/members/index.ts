import { z } from 'zod';
import { emailSchema, passwordSchema } from '../identity/index.js';

// ---------- Requests ----------

const roleNameSchema = z.string().trim().min(1, 'Elige un rol').max(50);
const shopIdsSchema = z.array(z.number().int().positive()).max(500);

/** Acceso a tiendas: todas, o una lista explícita (al menos una). */
const shopAccessSchema = z
  .object({ allShopsAccess: z.boolean(), shopIds: shopIdsSchema.default([]) })
  .refine((v) => v.allShopsAccess || v.shopIds.length > 0, {
    message: 'Elige al menos una tienda o da acceso a todas',
    path: ['shopIds'],
  });

export const inviteMemberSchema = z
  .object({ email: emailSchema, roleName: roleNameSchema })
  .and(shopAccessSchema);
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InviteMemberData = z.output<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({ roleName: roleNameSchema }).and(shopAccessSchema);
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type UpdateMemberData = z.output<typeof updateMemberSchema>;

/** Aceptar invitación sin cuenta previa: crea el usuario. */
export const acceptInvitationNewUserSchema = z.object({
  firstName: z.string().trim().min(1, 'Requerido').max(100),
  lastName: z.string().trim().min(1, 'Requerido').max(100),
  password: passwordSchema,
});
/** Aceptar invitación con una cuenta que ya existe: confirma con su contraseña. */
export const acceptInvitationExistingUserSchema = z.object({
  password: z.string().min(1, 'Requerido').max(128),
});
export const acceptInvitationSchema = z.union([acceptInvitationNewUserSchema, acceptInvitationExistingUserSchema]);
export type AcceptInvitationData = z.output<typeof acceptInvitationSchema>;

// ---------- Responses ----------

export type MemberResponse = {
  tenantUserId: number;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  allShopsAccess: boolean;
  shopIds: number[];
  /** El miembro es el usuario de la sesión (no puede editarse a sí mismo). */
  isYou: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
};

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type InvitationResponse = {
  id: number;
  email: string;
  role: string;
  allShopsAccess: boolean;
  shopIds: number[];
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
};

/** Al crear o reenviar: el link se muestra UNA sola vez (solo se guarda su hash). */
export type CreatedInvitationResponse = InvitationResponse & { inviteUrl: string };

export type RoleResponse = {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  /** Rol del sistema (Dueño): todos los permisos, no se edita ni elimina. */
  isSystem: boolean;
  /** Miembros con este rol (un rol en uso no se puede eliminar). */
  membersCount: number;
};

/** Opción liviana de rol para selectores (sin paginar). */
export type RoleOptionResponse = Pick<RoleResponse, 'id' | 'name' | 'description' | 'permissions' | 'isSystem'>;

/** Vista pública de una invitación (pantalla /invite/[token]). */
export type InvitationPreviewResponse = {
  companyName: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  /** Ya existe una cuenta con ese email: se acepta con su contraseña. */
  userExists: boolean;
};

export type AcceptInvitationResponse = {
  /** Empresa a la que se unió (para redirigir a /{slug}/all). */
  slug: string;
};
