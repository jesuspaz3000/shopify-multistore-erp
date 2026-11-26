import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// Parámetros argon2id recomendados por OWASP (m=19 MiB, t=2, p=1).
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  // Hash de relleno: si el email no existe, igual se verifica contra algo para que
  // la respuesta tarde lo mismo y no se pueda adivinar qué emails están registrados.
  private readonly dummyHash = hash('dummy-password-for-constant-time', ARGON2_OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /** Verifica en tiempo (aprox.) constante. `storedHash` null => siempre false. */
  async verify(storedHash: string | null | undefined, password: string): Promise<boolean> {
    try {
      if (!storedHash) {
        await verify(await this.dummyHash, password);
        return false;
      }
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }
}
