import { generateToken, hashToken } from './session-token.js';

describe('session-token', () => {
  it('genera tokens de 256 bits distintos en cada llamada', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
  });

  it('hashea de forma determinista con SHA-256 (64 hex) y sin exponer el token', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
