import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Monorepo: carga el .env de la raíz (apps/web/.env* local sigue teniendo prioridad).
loadEnvConfig(path.resolve(process.cwd(), '../..'));

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No revelar el stack tecnológico (X-Powered-By: Next.js).
  poweredByHeader: false,

  // El navegador llama a /api/* (mismo origen: cookies httpOnly sin CORS)
  // y Next lo reenvía a la API NestJS.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
