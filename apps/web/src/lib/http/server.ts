import 'server-only';

import axios from 'axios';
import { cookies } from 'next/headers';
import { createHttp, type Http } from './create-http';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8080';

/**
 * Cliente HTTP para Server Components, Server Actions y Route Handlers.
 * Se crea por request para reenviar la cookie de sesión del usuario a la API.
 */
export async function getServerHttp(): Promise<Http> {
  const cookieStore = await cookies();
  const instance = axios.create({
    baseURL: API_INTERNAL_URL,
    timeout: 15_000,
    headers: { cookie: cookieStore.toString() },
  });
  return createHttp(instance);
}
