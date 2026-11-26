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
});

export type Env = z.infer<typeof envSchema>;
