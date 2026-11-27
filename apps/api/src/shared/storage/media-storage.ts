import type { Readable } from 'node:stream';

/**
 * Almacenamiento de archivos (imágenes de productos). La app solo conoce esta interfaz:
 * hoy disco local (desarrollo); en producción, una implementación S3/R2/MinIO con la misma forma.
 * (Cuando @nestjs/storage llegue a una versión estable 1.x se puede usar detrás de esta misma interfaz.)
 */
export abstract class MediaStorage {
  /** Guarda el archivo bajo `key` (ruta relativa generada por el servidor, nunca por el usuario). */
  abstract put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Abre el archivo para enviarlo; null si no existe. */
  abstract open(key: string): Promise<{ stream: Readable; size: number } | null>;
  abstract delete(key: string): Promise<void>;
}

/** Claves seguras: segmentos alfanuméricos con '-', '_' y '.', sin '..' ni rutas absolutas. */
export function assertSafeKey(key: string): void {
  const ok = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i.test(key) && !key.split('/').includes('..');
  if (!ok || key.length > 500) throw new Error(`Clave de archivo inválida: ${key}`);
}
