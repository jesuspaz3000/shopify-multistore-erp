import type { MediaResponse } from '@erp/contracts';
import { http } from '@/lib/http';

/** Sube una imagen (multipart). El servidor verifica el tipo real por los bytes. */
export function uploadMedia(tenant: string, file: File): Promise<MediaResponse> {
  const form = new FormData();
  form.append('file', file);
  return http.upload<MediaResponse>(`/tenants/${encodeURIComponent(tenant)}/media`, form);
}

/** La API devuelve rutas relativas a ella; el navegador la alcanza en /api (mismo origen: lleva la sesión). */
export const mediaSrc = (url: string) => `/api${url}`;
