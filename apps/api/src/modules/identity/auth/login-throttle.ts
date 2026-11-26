// Bloqueo temporal de cuenta ante fuerza bruta.
export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60_000;

/** Fecha de desbloqueo si se alcanzó el máximo de intentos; null si no corresponde bloquear. */
export function lockUntilFor(failedAttempts: number, now = new Date()): Date | null {
  return failedAttempts >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
}

export function isLocked(lockedUntil: Date | null | undefined, now = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}
