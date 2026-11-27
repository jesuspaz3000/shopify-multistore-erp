import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';

/**
 * Cifrado AES-256-GCM de secretos de Shopify (Client secret, tokens) antes de guardarlos.
 *
 * Formato: `v{versión}.{iv}.{tag}.{datos}` (base64url). La versión permite rotar la llave más adelante.
 * El `context` (ej. "shop:12:client_secret") va como dato autenticado (AAD): un valor cifrado
 * copiado a otra fila o a otro campo no se puede descifrar.
 */
@Injectable()
export class TokenCipher {
  static readonly KEY_VERSION = 1;
  private readonly key: Buffer | null;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    this.key = raw ? Buffer.from(raw, 'base64') : null;
  }

  get configured(): boolean {
    return this.key !== null;
  }

  encrypt(plain: string, context: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [`v${TokenCipher.KEY_VERSION}`, iv, cipher.getAuthTag(), data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  decrypt(payload: string, context: string): string {
    const key = this.requireKey();
    const [version, iv, tag, data] = payload.split('.');
    if (version !== `v${TokenCipher.KEY_VERSION}` || !iv || !tag || data === undefined) {
      throw new Error('Formato de secreto cifrado desconocido');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    // Llave distinta, datos alterados o contexto equivocado: final() lanza error.
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'Falta TOKEN_ENCRYPTION_KEY en el servidor: sin ella no se pueden guardar credenciales de Shopify',
      );
    }
    return this.key;
  }
}
