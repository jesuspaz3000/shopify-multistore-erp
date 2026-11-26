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

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
