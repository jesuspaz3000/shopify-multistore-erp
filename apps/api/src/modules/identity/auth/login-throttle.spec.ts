import { isLocked, LOCK_DURATION_MS, lockUntilFor, MAX_FAILED_LOGINS } from './login-throttle.js';

describe('login-throttle', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('no bloquea antes del máximo de intentos', () => {
    expect(lockUntilFor(MAX_FAILED_LOGINS - 1, now)).toBeNull();
  });

  it('bloquea al alcanzar el máximo, por la duración configurada', () => {
    expect(lockUntilFor(MAX_FAILED_LOGINS, now)?.getTime()).toBe(now.getTime() + LOCK_DURATION_MS);
  });

  it('considera bloqueada la cuenta solo mientras no venza el bloqueo', () => {
    expect(isLocked(new Date(now.getTime() + 1), now)).toBe(true);
    expect(isLocked(new Date(now.getTime() - 1), now)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});
