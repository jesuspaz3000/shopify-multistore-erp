import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { AuthService } from './auth.service.js';

/** AuthService con dependencias falsas: solo se prueba la lógica que depende de la configuración. */
function makeService(env: Partial<Env>) {
  const config = { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>;
  const repo = { transaction: vi.fn(), findUserByEmail: vi.fn() };
  const passwords = { hash: vi.fn() };
  const service = new AuthService(repo as never, passwords as never, {} as never, {} as never, {} as never, config);
  return { service, repo, passwords };
}

describe('AuthService', () => {
  const input = { companyName: 'Acme', firstName: 'Ana', lastName: 'Pérez', email: 'ana@acme.com', password: 'clave-segura-123' };

  it('rechaza el registro con 403 cuando ALLOW_SIGNUP=false, sin tocar la base de datos', async () => {
    const { service, repo, passwords } = makeService({ ALLOW_SIGNUP: false });
    await expect(service.register(input, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(passwords.hash).not.toHaveBeenCalled();
    expect(repo.transaction).not.toHaveBeenCalled();
  });

  it('informa las opciones de login según la configuración', () => {
    expect(makeService({ ALLOW_SIGNUP: false }).service.getConfig()).toEqual({ signupEnabled: false, googleEnabled: false });
    expect(
      makeService({ ALLOW_SIGNUP: true, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }).service.getConfig(),
    ).toEqual({ signupEnabled: true, googleEnabled: true });
    // Una credencial vacía no habilita Google.
    expect(makeService({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '' }).service.getConfig().googleEnabled).toBe(false);
  });
});
