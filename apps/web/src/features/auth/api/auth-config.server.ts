import 'server-only';

import type { AuthConfigResponse } from '@erp/contracts';
import { connection } from 'next/server';
import { cache } from 'react';
import { getServerHttp } from '@/lib/http/server';

const FALLBACK: AuthConfigResponse = { signupEnabled: false, googleEnabled: false };

/**
 * Opciones de login habilitadas en la API (registro público, Google).
 * `connection()`: se consulta en cada request (no en el build, donde la API puede no estar arriba).
 * Si la API no responde, se asume lo más restrictivo.
 */
export const getAuthConfig = cache(async (): Promise<AuthConfigResponse> => {
  await connection();
  try {
    const http = await getServerHttp();
    return await http.get<AuthConfigResponse>('/auth/config');
  } catch {
    return FALLBACK;
  }
});
