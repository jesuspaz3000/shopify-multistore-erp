import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { TokenCipher } from './token-cipher.js';

const cipherWith = (key?: string) => new TokenCipher({ get: () => key } as unknown as ConfigService<never, true>);

describe('TokenCipher', () => {
  const key = randomBytes(32).toString('base64');

  it('cifra y descifra; el texto cifrado no contiene el secreto y cambia en cada llamada', () => {
    const cipher = cipherWith(key);
    const a = cipher.encrypt('shpss_secreto', 'shop:1:client_secret');
    const b = cipher.encrypt('shpss_secreto', 'shop:1:client_secret');
    expect(a).not.toContain('shpss_secreto');
    expect(a).not.toBe(b); // IV aleatorio
    expect(a.startsWith('v1.')).toBe(true);
    expect(cipher.decrypt(a, 'shop:1:client_secret')).toBe('shpss_secreto');
  });

  it('no descifra con otro contexto (otra tienda u otro campo), otra llave o datos alterados', () => {
    const cipher = cipherWith(key);
    const payload = cipher.encrypt('token', 'shop:1:access_token');
    expect(() => cipher.decrypt(payload, 'shop:2:access_token')).toThrow();
    expect(() => cipher.decrypt(payload, 'shop:1:client_secret')).toThrow();
    expect(() => cipherWith(randomBytes(32).toString('base64')).decrypt(payload, 'shop:1:access_token')).toThrow();
    const parts = payload.split('.');
    parts[3] = Buffer.from('otro').toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'), 'shop:1:access_token')).toThrow();
  });

  it('sin llave configurada responde 503 al intentar cifrar', () => {
    const cipher = cipherWith(undefined);
    expect(cipher.configured).toBe(false);
    expect(() => cipher.encrypt('x', 'c')).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});
