import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('genera hashes argon2id que verifican la contraseña correcta', async () => {
    const hash = await service.hash('una-clave-larga-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'una-clave-larga-123')).resolves.toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await service.hash('una-clave-larga-123');
    await expect(service.verify(hash, 'otra-clave')).resolves.toBe(false);
  });

  it('devuelve false (sin lanzar) si no hay hash o el hash es inválido', async () => {
    await expect(service.verify(null, 'lo-que-sea')).resolves.toBe(false);
    await expect(service.verify('no-es-un-hash', 'lo-que-sea')).resolves.toBe(false);
  });
});
