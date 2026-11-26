import type { ShopStatus } from '@erp/contracts';

// Opciones de los formularios de tienda (los códigos se validan en @erp/contracts).

export const CURRENCIES = [
  { code: 'PEN', label: 'PEN · Sol peruano' },
  { code: 'USD', label: 'USD · Dólar estadounidense' },
  { code: 'CLP', label: 'CLP · Peso chileno' },
  { code: 'MXN', label: 'MXN · Peso mexicano' },
  { code: 'COP', label: 'COP · Peso colombiano' },
  { code: 'ARS', label: 'ARS · Peso argentino' },
  { code: 'BRL', label: 'BRL · Real brasileño' },
  { code: 'EUR', label: 'EUR · Euro' },
];

export const COUNTRIES = [
  { code: 'PE', label: 'Perú' },
  { code: 'CL', label: 'Chile' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
  { code: 'BR', label: 'Brasil' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'España' },
];

export const STATUS_LABELS: Record<ShopStatus, { label: string; color: 'warning' | 'success' | 'default' | 'error' }> = {
  pending_connection: { label: 'Pendiente de conexión', color: 'warning' },
  installed: { label: 'Conectada', color: 'success' },
  uninstalled: { label: 'Desinstalada', color: 'default' },
  frozen: { label: 'Congelada', color: 'error' },
  paused: { label: 'Pausada', color: 'default' },
};

/** Zonas horarias IANA del navegador (ej. America/Lima). */
export function timezoneOptions(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
}

export const countryLabel = (code: string | null) => COUNTRIES.find((c) => c.code === code)?.label ?? code ?? '—';
