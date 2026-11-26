import axios from 'axios';
import { createHttp } from './create-http';

// Instancia para Client Components. Usa /api (rewrite de next.config.ts), así las
// cookies de sesión viajan en el mismo origen, sin CORS.
const browserInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
});

export const http = createHttp(browserInstance);
