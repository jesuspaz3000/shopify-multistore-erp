import { z } from 'zod';

// ---------- Campos reutilizables ----------

export const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.email('Email inválido'));

// Reglas de contraseña: largo antes que complejidad (recomendación NIST 800-63B).
export const PASSWORD_MIN_LENGTH = 10;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(128, 'Máximo 128 caracteres');

const personNameSchema = z.string().trim().min(1, 'Requerido').max(100);

// ---------- Requests ----------

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(255),
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // En login no se validan reglas de complejidad: solo que venga algo.
  password: z.string().min(1, 'Requerido').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- Responses ----------

export type SessionUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  /** Administrador de la plataforma (por encima de las empresas). */
  isSuperuser: boolean;
};

export type TenantMembership = {
  tenantId: number;
  slug: string;
  companyName: string;
  role: string;
  allShopsAccess: boolean;
};

export type MeResponse = {
  user: SessionUser;
  memberships: TenantMembership[];
};
