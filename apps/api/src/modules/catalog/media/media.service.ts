import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { MEDIA_MAX_BYTES, type MediaResponse } from '@erp/contracts';
import type { Tx } from '../../../shared/database/database.module.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { MediaStorage } from '../../../shared/storage/media-storage.js';
import { sniffImage } from './image-sniff.js';
import { MediaRepository, type MediaRow } from './media.repository.js';

/** URL (relativa a la API) desde la que se sirve una imagen de la empresa. */
export const mediaUrl = (tenantSlug: string, mediaId: number) => `/tenants/${tenantSlug}/media/${mediaId}/file`;

@Injectable()
export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: MediaStorage,
  ) {}

  toResponse(tenant: TenantContext, row: MediaRow): MediaResponse {
    return {
      id: row.id,
      url: mediaUrl(tenant.slug, row.id),
      alt: row.alt,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      fileSize: row.fileSize,
    };
  }

  /**
   * Guarda una imagen subida. El tipo se decide por los BYTES (no por el nombre ni el tipo que
   * declara el navegador) y el nombre del archivo lo genera el servidor. Si la empresa ya subió
   * exactamente el mismo archivo, se reutiliza.
   */
  async upload(tenant: TenantContext, file: { buffer: Buffer; size: number } | undefined): Promise<MediaResponse> {
    if (!file || file.size === 0) throw new BadRequestException('Adjunta una imagen');
    if (file.size > MEDIA_MAX_BYTES) throw new BadRequestException('La imagen supera los 20 MB');
    const image = sniffImage(file.buffer);
    if (!image) throw new UnsupportedMediaTypeException('Formato no admitido: sube una imagen JPG, PNG, GIF o WebP');

    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.repo.findByChecksum(tenant.tenantId, checksum);
    if (existing) return this.toResponse(tenant, existing);

    const storageKey = `${tenant.tenantId}/${randomUUID()}.${image.ext}`;
    await this.storage.put(storageKey, file.buffer, image.mimeType);
    const row = await this.repo.insert({
      tenantId: tenant.tenantId,
      storageKey,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      fileSize: file.size,
      checksumSha256: checksum,
    });
    return this.toResponse(tenant, row);
  }

  /** Archivo de una imagen de la empresa (para enviarlo). 404 si no es de la empresa o no existe. */
  async open(tenant: TenantContext, mediaId: number) {
    const row = await this.repo.findById(tenant.tenantId, mediaId);
    const file = row && (await this.storage.open(row.storageKey));
    if (!row || !file) throw new NotFoundException('Imagen no encontrada');
    return { ...file, mimeType: row.mimeType };
  }

  /** Asigna las imágenes del producto (en orden); todas deben ser de la empresa. */
  async setProductMedia(tenantId: number, productId: number, items: { id: number; alt: string | null }[], tx: Tx) {
    const existing = await this.repo.existingIds(
      tenantId,
      items.map((m) => m.id),
      tx,
    );
    if (items.some((m) => !existing.has(m.id))) throw new BadRequestException('Alguna imagen no existe (vuelve a subirla)');
    await this.repo.replaceProductMedia(tenantId, productId, items, tx);
  }

  async productMedia(tenant: TenantContext, productId: number): Promise<MediaResponse[]> {
    const rows = await this.repo.productMedia(tenant.tenantId, productId);
    return rows.map((row) => this.toResponse(tenant, row));
  }
}
