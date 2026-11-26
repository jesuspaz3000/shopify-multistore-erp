import 'server-only';

import type { MeResponse } from '@erp/contracts';
import { cache } from 'react';
import { ApiError } from './http/errors';
import { getServerHttp } from './http/server';

/**
 * Usuario de la sesión actual, o null si no hay sesión válida.
 * `cache` evita repetir la llamada a la API dentro del mismo request (layout + páginas).
 */
export const getMe = cache(async (): Promise<MeResponse | null> => {
  const http = await getServerHttp();
  try {
    return await http.get<MeResponse>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});
