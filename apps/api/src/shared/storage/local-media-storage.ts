import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { assertSafeKey, MediaStorage } from './media-storage.js';

/** Archivos en disco local (solo desarrollo: en producción se pierden al redesplegar). */
@Injectable()
export class LocalMediaStorage extends MediaStorage implements OnModuleInit {
  private readonly logger = new Logger(LocalMediaStorage.name);
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.root = resolve(process.cwd(), config.get('MEDIA_STORAGE_ROOT', { infer: true }));
  }

  async onModuleInit() {
    await mkdir(this.root, { recursive: true });
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('Imágenes en disco local: en producción usa un almacenamiento tipo S3.');
    }
  }

  /** Ruta absoluta dentro de la raíz (doble control contra salir de la carpeta). */
  private path(key: string): string {
    assertSafeKey(key);
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error(`Clave fuera del almacenamiento: ${key}`);
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    // Escritura atómica: se escribe aparte y se renombra (nunca queda un archivo a medias).
    const temp = `${full}.${process.pid}.tmp`;
    await writeFile(temp, data);
    await rename(temp, full);
  }

  async open(key: string) {
    const full = this.path(key);
    try {
      const info = await stat(full);
      return { stream: createReadStream(full), size: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
