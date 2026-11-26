import axios from 'axios';

// Instancia axios para Client Components.
// Usa /api (rewrite de next.config.ts) para que las cookies de sesión viajen sin CORS.
export const browserApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
});

// Interceptores (401 -> redirigir a /login, normalizar errores) se agregan aquí.
