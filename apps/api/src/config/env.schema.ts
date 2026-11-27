import { z } from 'zod';

// Variables de entorno que la API necesita. Se validan al arrancar:
// si falta una obligatoria, la app no inicia (falla rápido, no en el primer request).
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(8080),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),

  // Registro PÚBLICO de nuevas empresas. false (por defecto): administración privada; las empresas
  // las crea el superadmin con `npm run tenant:create` y los empleados entran por invitación.
  ALLOW_SIGNUP: z.stringbool().default(false),

  // Login con Google: se habilita solo si ambas credenciales están definidas.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Duración de la sesión (días). Se renueva con el uso (sliding expiration).
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Archivos subidos (imágenes de productos). En desarrollo, disco local (relativo a apps/api).
  // En producción irá un almacenamiento tipo S3 (en disco local los archivos se pierden al redesplegar).
  MEDIA_STORAGE_ROOT: z.string().default('../../storage/media'),

  // Llave AES-256-GCM (32 bytes en base64) con la que se cifran el Client secret y los tokens
  // de Shopify en la base de datos. Sin ella no se pueden conectar tiendas (el resto funciona).
  // Generarla: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined) // vacía en el .env = no configurada
    .refine((v) => v === undefined || Buffer.from(v, 'base64').length === 32, 'Debe ser de 32 bytes en base64'),
  // Versión ESTABLE del Admin API fijada en cada llamada (Shopify publica una por trimestre).
  SHOPIFY_API_VERSION: z
    .string()
    .regex(/^\d{4}-(01|04|07|10)$/, 'Formato AAAA-MM (ej. 2026-10)')
    .default('2026-10'),
});

export type Env = z.infer<typeof envSchema>;
