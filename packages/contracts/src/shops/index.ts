import { z } from 'zod';

// ---------- Campos ----------

/** Campo de texto opcional en formularios: '' se trata como "no informado". */
const optionalField = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .optional()
    .transform((value) => (value ? value : undefined));

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Código ISO de 3 letras (ej. USD, PEN, CLP)');

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Código ISO de 2 letras (ej. PE, CL)');

export const timezoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria inválida (ej. America/Lima)');

// ---------- Requests ----------

export const createShopSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(255),
  currencyCode: currencyCodeSchema,
  countryCode: optionalField(countryCodeSchema),
  ianaTimezone: optionalField(timezoneSchema),
});
export type CreateShopInput = z.input<typeof createShopSchema>;
export type CreateShopData = z.output<typeof createShopSchema>;

/** Al editar: campo ausente = no cambia; '' en un campo opcional = se borra (null). */
const clearableField = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .transform((value) => (value ? value : null))
    .optional();

export const updateShopSchema = z.object({
  name: createShopSchema.shape.name.optional(),
  currencyCode: currencyCodeSchema.optional(),
  countryCode: clearableField(countryCodeSchema),
  ianaTimezone: clearableField(timezoneSchema),
});
export type UpdateShopInput = z.input<typeof updateShopSchema>;
export type UpdateShopData = z.output<typeof updateShopSchema>;

// ---------- Conexión con Shopify ----------

/**
 * Permisos que la app de Shopify debe tener para que el ERP sincronice catálogo e inventario.
 * Un permiso write_* incluye su read_* (Shopify a veces solo informa el write).
 */
export const SHOPIFY_REQUIRED_SCOPES = [
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_locations',
  'read_files',
  'write_files',
  'read_publications',
  'write_publications',
] as const;

export function missingShopifyScopes(granted: readonly string[]): string[] {
  const have = new Set(granted);
  return SHOPIFY_REQUIRED_SCOPES.filter((scope) => !have.has(scope) && !have.has(scope.replace(/^read_/, 'write_')));
}

/**
 * Normaliza lo que el usuario pega como tienda a "algo.myshopify.com":
 * "algo", "https://algo.myshopify.com/admin", "admin.shopify.com/store/algo".
 * Devuelve null si no es un dominio myshopify válido (el servidor nunca llama a otro host).
 */
export function normalizeShopDomain(value: string): string | null {
  let v = value.trim().toLowerCase().replace(/^https?:\/\//, '');
  const admin = /^admin\.shopify\.com\/store\/([a-z0-9-]+)/.exec(v);
  if (admin) v = admin[1];
  v = v.split(/[/?#]/)[0];
  if (!v.includes('.')) v = `${v}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/.test(v) ? v : null;
}

export const connectShopifySchema = z.object({
  myshopifyDomain: z
    .string()
    .trim()
    .min(1, 'Ingresa el dominio de la tienda')
    .transform((value, ctx) => {
      const domain = normalizeShopDomain(value);
      if (!domain) {
        ctx.addIssue({ code: 'custom', message: 'Debe ser un dominio .myshopify.com (ej. mi-tienda.myshopify.com)' });
        return z.NEVER;
      }
      return domain;
    }),
  clientId: z
    .string()
    .trim()
    .min(1, 'Ingresa el ID de cliente')
    .max(255)
    .regex(/^[A-Za-z0-9_-]+$/, 'ID de cliente inválido'),
  clientSecret: z.string().trim().min(1, 'Ingresa el secreto de cliente').max(512),
});
export type ConnectShopifyInput = z.input<typeof connectShopifySchema>;
export type ConnectShopifyData = z.output<typeof connectShopifySchema>;

// ---------- Responses ----------

export const SHOP_STATUSES = ['pending_connection', 'installed', 'uninstalled', 'frozen', 'paused'] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

export type ShopResponse = {
  id: number;
  /** Identificador en la URL: /{empresa}/{handle}/... */
  handle: string;
  name: string;
  currencyCode: string;
  countryCode: string | null;
  ianaTimezone: string | null;
  status: ShopStatus;
  myshopifyDomain: string | null;
  /** Datos de la conexión con Shopify (null si aún no está conectada). Nunca incluye secretos. */
  shopify: ShopifyConnectionInfo | null;
  createdAt: string;
};

export type ShopifyConnectionInfo = {
  clientId: string;
  apiVersion: string;
  scopes: string[];
  /** Permisos requeridos que la app no tiene: hay que agregarlos en el Dev Dashboard. */
  missingScopes: string[];
  planName: string | null;
  primaryDomain: string | null;
  connectedAt: string;
};

/** Opción liviana de tienda para selectores (sin paginar). */
export type ShopOptionResponse = { id: number; handle: string; name: string };
