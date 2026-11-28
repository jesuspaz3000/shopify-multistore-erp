import type { MediaDetailResponse, MediaResponse } from '@erp/contracts';
import { http } from '@/lib/http';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}/media`;

/** Sube una imagen (multipart). El servidor verifica el tipo real por los bytes. */
export function uploadMedia(tenant: string, file: File): Promise<MediaResponse> {
  const form = new FormData();
  // El nombre va en un campo de texto (UTF-8): el del archivo multipart puede llegar mal codificado.
  form.append('filename', file.name);
  form.append('file', file);
  return http.upload<MediaResponse>(base(tenant), form);
}

/** Detalle de una imagen: nombre, tamaño, fecha y en cuántos productos se usa. */
export const getMedia = (tenant: string, mediaId: number) => http.get<MediaDetailResponse>(`${base(tenant)}/${mediaId}`);

export const renameMedia = (tenant: string, mediaId: number, filename: string) =>
  http.patch<MediaDetailResponse>(`${base(tenant)}/${mediaId}`, { filename });

/** La API devuelve rutas relativas a ella; el navegador la alcanza en /api (mismo origen: lleva la sesión). */
export const mediaSrc = (url: string) => `/api${url}`;
