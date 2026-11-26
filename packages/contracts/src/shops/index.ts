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
  createdAt: string;
};
