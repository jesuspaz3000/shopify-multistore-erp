import { createHash, randomBytes } from 'node:crypto';

/** Token opaco de 256 bits para la cookie de sesión (o tokens de email). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** En la BD solo se guarda el SHA-256: si se filtra la tabla, los tokens no sirven. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
