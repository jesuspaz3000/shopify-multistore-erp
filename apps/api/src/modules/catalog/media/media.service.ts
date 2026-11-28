import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { MEDIA_MAX_BYTES, type MediaDetailResponse, type MediaResponse, type UpdateMediaData } from '@erp/contracts';
import type { Tx } from '../../../shared/database/database.module.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { MediaStorage } from '../../../shared/storage/media-storage.js';
import { sniffImage } from './image-sniff.js';
import { MediaRepository, type MediaRow } from './media.repository.js';

/** URL (relativa a la API) desde la que se sirve una imagen de la empresa. */
export const mediaUrl = (tenantSlug: string, mediaId: number) => `/tenants/${tenantSlug}/media/${mediaId}/file`;

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Nombre para imágenes guardadas sin nombre (antes de que existiera el campo). */
const defaultFilename = (row: Pick<MediaRow, 'id' | 'mimeType'>) => `imagen-${row.id}.${EXTENSIONS[row.mimeType] ?? 'img'}`;

/** Nombre visible a partir del que trae el archivo: sin rutas ni caracteres de control, hasta 255. */
export function cleanFilename(value: string | null | undefined): string | null {
  const base = (value ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return clean || null;
}

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
      filename: row.filename ?? defaultFilename(row),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Imagen con su uso (en cuántos productos vigentes aparece). */
  async detail(tenant: TenantContext, mediaId: number): Promise<MediaDetailResponse> {
    const row = await this.findOrFail(tenant, mediaId);
    const products = await this.repo.productUsage(tenant.tenantId, mediaId);
    return { ...this.toResponse(tenant, row), usage: { products } };
  }

  /** Renombra la imagen (el nombre visible; el archivo guardado no cambia). */
  async rename(tenant: TenantContext, mediaId: number, input: UpdateMediaData): Promise<MediaDetailResponse> {
    await this.findOrFail(tenant, mediaId);
    await this.repo.update(tenant.tenantId, mediaId, { filename: input.filename });
    return this.detail(tenant, mediaId);
  }

  private async findOrFail(tenant: TenantContext, mediaId: number): Promise<MediaRow> {
    const row = await this.repo.findById(tenant.tenantId, mediaId);
    if (!row) throw new NotFoundException('Imagen no encontrada');
    return row;
  }

  /**
   * Guarda una imagen subida. El tipo se decide por los BYTES (no por el nombre ni el tipo que
   * declara el navegador) y el nombre del archivo lo genera el servidor. Si la empresa ya subió
   * exactamente el mismo archivo, se reutiliza.
   */
  async upload(
    tenant: TenantContext,
    file: { buffer: Buffer; size: number } | undefined,
    filename?: string | null,
  ): Promise<MediaResponse> {
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
      filename: cleanFilename(filename),
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
