// Contexto de autenticación que el SessionGuard adjunta a cada request.

export type AuthUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  isSuperuser: boolean;
};

export type AuthContext = {
  sessionId: string;
  user: AuthUser;
};

/** Empresa de la URL (/tenants/:tenant/...) validada por el TenantGuard. */
export type TenantContext = {
  tenantId: number;
  slug: string;
  tenantUserId: number;
  role: string;
  permissions: string[];
  /** null = acceso a todas las tiendas; si no, solo a estos shop ids. */
  allowedShopIds: number[] | null;
};

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    tenant?: TenantContext;
  }
}
