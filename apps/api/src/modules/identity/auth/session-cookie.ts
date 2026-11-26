import type { Response } from 'express';

export const SESSION_COOKIE = 'erp_sid';

const baseOptions = (secure: boolean) =>
  ({
    httpOnly: true, // JavaScript del navegador no puede leerla (mitiga XSS)
    secure, // solo HTTPS en producción
    sameSite: 'lax', // no se envía en POST cross-site (mitiga CSRF)
    path: '/',
  }) as const;

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(secure), expires: expiresAt });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}
