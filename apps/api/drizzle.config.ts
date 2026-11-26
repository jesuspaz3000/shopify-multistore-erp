import { defineConfig } from 'drizzle-kit';

// Monorepo: las variables viven en el .env de la raíz.
try {
  process.loadEnvFile('../../.env');
} catch {
  // En CI/producción las variables vienen del entorno.
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida (revisa el .env de la raíz)');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/database/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
