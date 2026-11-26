import 'server-only';

import axios from 'axios';
import { cookies } from 'next/headers';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8080';

// Instancia axios para Server Components, Server Actions y Route Handlers.
// Se crea por request para reenviar la cookie de sesión del usuario a la API.
export async function getServerApi() {
  const cookieStore = await cookies();

  return axios.create({
    baseURL: API_INTERNAL_URL,
    timeout: 15_000,
    headers: {
      cookie: cookieStore.toString(),
    },
  });
}
